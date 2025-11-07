/* eslint-disable max-lines */
import {
  OPS,
  PixelsPerInch,
  RenderingCancelledException,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type PageViewport,
  type RenderTask,
} from 'pdfjs-dist'
import ExclamationMarkIcon from '../assets/exclamation-mark.svg?raw'
import Loading1Icon from '../assets/loading1.svg?raw'
import RefreshIcon from '../assets/refresh.svg?raw'
import { PDFTransViewerEvents, type PDFEventBus } from '../events'
import { setLayerDimensions } from '../utils/display'
import { RenderingStates } from '../utils/ui'
import { type LinkService } from './LinkService'
import {
  PDFRenderingQueue,
  type PDFRenderingQueueView,
} from './PDFRenderingQueue'
import { PDFTransEditorLayerPrint } from './PDFTransEditorLayer'
import { PDFTransEditorLayerBuilder } from './PDFTransEditorLayerBuilder'
// import { PDFTransOCRLayer } from './PDFTransOCRLayer'
import {
  PDFTransViewerUIManager,
  TranslationStatus,
  type Paragraph,
} from './PDFTransViewerUIManager'
import { PDFViewer, SpreadMode } from './PDFViewer'

interface PDFTransPageViewOptions {
  id: number
  scale: number
  defaultViewport: PageViewport
  linkService: LinkService
  pdfViewer: PDFViewer
  eventBus: PDFEventBus
  renderingQueue: PDFRenderingQueue
  transUIManager: PDFTransViewerUIManager
}

const LAYERS_ORDER = new Map([
  ['canvas', 0],
  ['transEditorLayer', 1],
  ['ocrButton', 2],
])

export class PDFTransCanvasIntercept {
  constructor(protected id: number) {}
  // 生成 canvas id
  generateCanvasId() {
    return `pdf-trans-canvas-${this.id}`
  }

  findInternalRenderTask(
    renderTaskSet: Set<any>,
    callback: (task: any) => boolean | void,
  ) {
    for (const task of renderTaskSet) {
      if (callback(task)) {
        return task
      }
    }
  }

  // 基础文本拦截
  interceptBaseText(ctx: CanvasRenderingContext2D) {
    const originalFillText = ctx.fillText
    const originalStrokeText = ctx.strokeText
    ctx.fillText = () => {}
    ctx.strokeText = () => {}
    return () => {
      ctx.fillText = originalFillText
      ctx.strokeText = originalStrokeText
    }
  }

  // 拦截 gfx
  interceptGfx(internalRenderTask: any, ctx: CanvasRenderingContext2D) {
    const gfx = internalRenderTask.gfx

    const interceptOPS = [OPS.showText, OPS.fill]
    const original: Record<number, (...args: any[]) => void> = {}

    interceptOPS.forEach((opCode) => {
      original[opCode] = gfx[opCode]
      gfx[opCode] = function (...args: any[]) {
        if (OPS.fill === opCode) {
          if (!Object.hasOwn(this.current, 'font')) {
            original[opCode]!.apply(this, args)
          }
        }
      }
    })

    return () => {
      interceptOPS.forEach((opCode) => {
        gfx[opCode] = original[opCode]
      })
    }
  }

  // 拦截 CanvasGraphics 的绘制
  interceptCanvasGraphics(
    pdfPage: PDFPageProxy,
    cacheKey: string,
    ctx: CanvasRenderingContext2D,
    id: string,
  ) {
    const intentStates = pdfPage?._intentStates.get(cacheKey)
    if (!intentStates?.renderTasks) {
      return this.interceptBaseText(ctx)
    }
    const internalRenderTask = this.findInternalRenderTask(
      intentStates.renderTasks,
      (task: any) => task._canvas.id === id,
    )
    if (!internalRenderTask) {
      return this.interceptBaseText(ctx)
    }
    return this.interceptGfx(internalRenderTask, ctx)
  }
}

export class PDFTransPageViewPrint extends PDFTransCanvasIntercept {
  public div: HTMLDivElement
  private pdfViewer: PDFViewer
  private pdfDocument: PDFDocumentProxy
  private renderTask: RenderTask | null
  private _pageRenderCapability: PromiseWithResolvers<PDFTransPageViewPrint>
  private transEditorLayer: PDFTransEditorLayerPrint | null
  private paragraphs: Paragraph[]
  constructor(options: {
    id: number
    pdfViewer: PDFViewer
    pdfDocument: PDFDocumentProxy
    paragraph: Paragraph[]
  }) {
    super(options.id)
    this.pdfViewer = options.pdfViewer
    this.pdfDocument = options.pdfDocument
    this.paragraphs = options.paragraph
    this._pageRenderCapability = Promise.withResolvers()
    const div = (this.div = document.createElement('div'))
    div.className = 'pdfTransPagePrint'
    div.setAttribute('data-page-number', `${this.id}`)
    this.renderTask = null
    this.transEditorLayer = null
  }

  get intent() {
    return 'display'
  }

  get renderCacheKey() {
    return this.pdfDocument._transport.getRenderingIntent(this.intent).cacheKey
  }

  get pageRenderedPromise() {
    return this._pageRenderCapability.promise
  }

  setDimensions(viewport: PageViewport) {
    setLayerDimensions(this.div, viewport, true, false)
  }

  /**
   * 获取下载翻译渲染的canvas层
   */
  async printDraw(pdfPage: PDFPageProxy, viewport: PageViewport) {
    if (this.renderTask) {
      return
    }
    this.setDimensions(viewport)

    const { width, height } = viewport
    const canvas = document.createElement('canvas')
    canvas.setAttribute('role', 'presentation')
    const id = 'download-canvas-' + this.generateCanvasId()
    canvas.id = id
    this.div.appendChild(canvas)

    const transEditorLayerDiv = document.createElement('div')
    transEditorLayerDiv.className = 'transEditorLayer'
    this.div.appendChild(transEditorLayerDiv)

    let interceptor: (() => void) | null = null
    const renderContinueCallback = (cont: () => void) => {
      interceptor ||= this.interceptCanvasGraphics(
        pdfPage,
        this.renderCacheKey,
        ctx,
        id,
      )
      cont()
    }
    const ctx = canvas.getContext('2d', {
      alpha: true,
      willReadFrequently: true,
    })!

    const devicePixelRatio =
      window.devicePixelRatio || PixelsPerInch.PDF_TO_CSS_UNITS
    canvas.width = width * devicePixelRatio
    canvas.height = height * devicePixelRatio

    const renderTask = (this.renderTask = pdfPage.render({
      canvasContext: ctx,
      intent: this.intent,
      transform: [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0],
      viewport: viewport,
    }))
    renderTask.onContinue = renderContinueCallback
    renderTask.promise.then(async () => {
      this.transEditorLayer = new PDFTransEditorLayerPrint({
        id: this.id,
        div: transEditorLayerDiv,
        viewport,
        paragraph: this.paragraphs,
      })
      await this.transEditorLayerRender(viewport)
      this._pageRenderCapability.resolve(this)
    })
    return this.pageRenderedPromise
  }

  async transEditorLayerRender(viewport: PageViewport) {
    if (!this.transEditorLayer) {
      return
    }
    this.div.classList.add('pdfTransPagePrintLayout')
    await this.transEditorLayer.render(viewport)
    this.div.classList.remove('pdfTransPagePrintLayout')
  }

  cancelRendering() {
    if (this.renderTask) {
      this.renderTask.cancel()
      this.renderTask = null
    }
    this.transEditorLayer?.destroy()
    this.transEditorLayer = null
  }

  destroy() {
    this.cancelRendering()
    this.div.remove()
    this.div.textContent = ''
  }
}

export class PDFTransPageView
  extends PDFTransCanvasIntercept
  implements PDFRenderingQueueView
{
  public id: number
  private pdfViewer: PDFViewer
  public pdfPage: PDFPageProxy | null
  public renderingState: RenderingStates
  public renderingId: string
  public div: HTMLDivElement
  private eventBus: PDFEventBus
  private transUIManager: PDFTransViewerUIManager
  private renderingQueue: PDFRenderingQueue
  private viewport: PageViewport
  private viewportMap: Map<HTMLCanvasElement, PageViewport> = new Map()
  private renderTask: RenderTask | null
  private renderError: Error | null
  private layers: (HTMLElement | null)[] = []
  private statusLayers: Partial<Record<TranslationStatus, HTMLElement | null>>
  private linkService: LinkService
  private transEditorLayerBuilder: PDFTransEditorLayerBuilder | null
  private ocrLayer: any | null
  public resume: (() => void) | null
  public scale: number
  private _status: TranslationStatus
  private _fetcherLoading

  constructor(options: PDFTransPageViewOptions) {
    super(options.id)
    this.id = options.id
    this.renderingId = `transPage-${this.id}`
    this.renderingState = RenderingStates.INITIAL
    this.renderingQueue = options.renderingQueue
    this.pdfViewer = options.pdfViewer
    this.eventBus = options.eventBus
    this.transUIManager = options.transUIManager
    this.linkService = options.linkService
    this.viewport = options.defaultViewport
    this.scale = options.scale
    this._status = TranslationStatus.Default
    this._fetcherLoading = false
    this.pdfPage = null
    this.ocrLayer = null
    this.transEditorLayerBuilder = null
    this.renderTask = null
    this.renderError = null
    this.statusLayers = {}
    this.resume = null
    const div = (this.div = document.createElement('div'))
    div.className = 'pdfTransPage'
    div.setAttribute('data-page-number', `${this.id}`)
  }

  get width() {
    return this.viewport.width
  }

  get height() {
    return this.viewport.height
  }

  set fetcherLoading(value: boolean) {
    this._fetcherLoading = value
    if (value) {
      this.ocrLayer?.hide()
    } else {
      this.ocrLayer?.show()
    }
  }

  get fetcherLoading() {
    return this._fetcherLoading
  }

  get transOCRLayer() {
    return this.ocrLayer
  }

  get status() {
    return this._status
  }

  setPdfPage(pdfPage: PDFPageProxy) {
    this.pdfPage = pdfPage
    const { spreadMode } = this.pdfViewer
    this.viewport = pdfPage.getViewport({
      scale: this.scale * PixelsPerInch.PDF_TO_CSS_UNITS,
    })
    if (
      spreadMode === SpreadMode.TRANSLATE ||
      spreadMode === SpreadMode.COMPARE
    ) {
      this.setDimensions()
      this.reset()
    }
  }

  setDimensions() {
    const { viewport } = this
    setLayerDimensions(this.div, viewport, true, false)
  }

  // 查找指定位置的编辑器
  findEditorItem(x: number, y: number) {
    return this.transUIManager?.findEditorItem(this.id, x, y) || null
  }

  private addLayer(element: HTMLElement, name: string) {
    const pos = LAYERS_ORDER.get(name)!
    const oldElement = this.layers[pos]
    this.layers[pos] = element
    if (oldElement) {
      oldElement.replaceWith(element)
      return
    }
    for (let i = pos - 1; i >= 0; i--) {
      const layer = this.layers[i]
      if (layer) {
        layer.after(element)
        return
      }
    }
    this.div.prepend(element)
  }

  private addStatusLayer(element: HTMLElement, status: TranslationStatus) {
    // 移除其他dom
    for (const s of Object.keys(this.statusLayers)) {
      if (s !== status) {
        this.statusLayers[s as TranslationStatus]?.remove()
      }
    }
    if (this.statusLayers[status]) {
      this.statusLayers[status]!.replaceWith(element)
      return
    }
    this.statusLayers[status] = element
    this.div.appendChild(element)
  }

  private getLayer(name: string) {
    return this.layers[LAYERS_ORDER.get(name)!]
  }

  private toggleCanvas(hidden: boolean) {
    const canvas = this.getLayer('canvas') as HTMLCanvasElement
    if (canvas) {
      canvas.hidden = hidden
    }
  }

  private createStatusBox() {
    const box = document.createElement('div')
    box.className = 'pdfTranslateStatusBox'
    return box
  }

  private translating() {
    const div = document.createElement('div')
    div.className = 'pdfTranslating'
    const box = this.createStatusBox()
    const iconSpan = document.createElement('span')
    iconSpan.className = 'animate-spin-icon pdfTranslateIcon'
    iconSpan.innerHTML = Loading1Icon
    const textSpan = document.createElement('span')
    textSpan.className = 'translateText'
    textSpan.innerHTML = this.pdfViewer.i18n.translating!
    box.appendChild(iconSpan)
    box.appendChild(textSpan)
    div.appendChild(box)
    this.addStatusLayer(div, TranslationStatus.Translating)
    this.ocrLayer?.hide()
  }

  private translatingDone() {
    this.setDimensions()
    this.ocrLayer?.show()
  }

  private retryTranslating() {
    const transUIManager = this.transUIManager
    transUIManager.setTranslationState(
      this.id,
      TranslationStatus.ForceTranslating,
    )
    transUIManager.renderParagraph(this.id)
  }

  private retryFetchData() {
    const transUIManager = this.transUIManager
    transUIManager.setTranslationState(this.id, TranslationStatus.Default)
    transUIManager.renderParagraph(this.id)
  }

  private createErrorLayer(text: string, retryCallback: () => void) {
    const div = document.createElement('div')
    div.className = 'pdfTranslateError'
    const box = this.createStatusBox()
    const iconSpan = document.createElement('span')
    iconSpan.className = 'pdfTranslateIcon'
    iconSpan.innerHTML = ExclamationMarkIcon
    const textSpan = document.createElement('span')
    textSpan.className = 'translateText'
    textSpan.innerHTML = text
    const button = document.createElement('button')
    button.className = 'translatingErrorButton'
    button.innerHTML = RefreshIcon
    const textNode = document.createTextNode(this.pdfViewer.i18n.retry!)
    button.appendChild(textNode)
    button.addEventListener('click', retryCallback, {
      once: true,
      capture: true,
    })
    box.appendChild(iconSpan)
    box.appendChild(textSpan)
    box.appendChild(button)
    div.appendChild(box)
    return div
  }

  private translatingError() {
    this.transEditorLayerBuilder?.removeAllEditorItems()
    const div = this.createErrorLayer(
      this.pdfViewer.i18n.transFailed!,
      this.retryTranslating.bind(this),
    )
    this.addStatusLayer(div, TranslationStatus.TranslatingError)
    this.ocrLayer?.show()
  }

  private fetchDataError() {
    this.transEditorLayerBuilder?.removeAllEditorItems()
    const div = this.createErrorLayer(
      this.pdfViewer.i18n.fetchDataError!,
      this.retryFetchData.bind(this),
    )
    this.addStatusLayer(div, TranslationStatus.FetchDataError)
    this.ocrLayer?.show()
  }

  private resetDefaultStatus() {
    this.transEditorLayerBuilder?.removeAllEditorItems()
  }

  updateStatus(status: TranslationStatus) {
    this._status = status
    this.resetStatusLayers()
    switch (status) {
      case TranslationStatus.Default:
        this.resetDefaultStatus()
        break
      case TranslationStatus.Translating:
        this.toggleCanvas(false)
        this.translating()
        break
      case TranslationStatus.TranslatingDone:
        this.toggleCanvas(false)
        this.translatingDone()
        break
      case TranslationStatus.TranslatingError:
        this.toggleCanvas(true)
        this.translatingError()
        break
      case TranslationStatus.FetchDataError:
        this.toggleCanvas(true)
        this.fetchDataError()
        break
    }
  }

  setDataLoaded(loaded: boolean) {
    if (!this.fetcherLoading) {
      this.div.setAttribute('data-loaded', `${loaded}`)
    }
  }

  async draw() {
    console.log('draw trans page ----', this.id, this.renderingState)
    if (this.renderingState !== RenderingStates.INITIAL) {
      console.error('Must be in new state before drawing')
      this.reset()
    }
    const { div, pdfPage, viewport } = this
    if (!pdfPage) {
      this.renderingState = RenderingStates.FINISHED
      throw new Error('pdfPage is not loaded')
    }
    this.renderingState = RenderingStates.RUNNING

    const { width, height } = viewport
    this.setDataLoaded(false)

    const id = this.generateCanvasId()
    const canvas = document.createElement('canvas')
    canvas.id = id
    canvas.setAttribute('role', 'presentation')

    this.addLayer(canvas, 'canvas')

    canvas.hidden = true

    let showCanvas = (isLastShow?: boolean) => {
      if (isLastShow) {
        this.toggleCanvas(false)
        // @ts-ignore
        showCanvas = null
      }
    }

    let interceptor: (() => void) | null = null

    const renderContinueCallback = (cont: () => void) => {
      showCanvas?.(false)
      interceptor ||= this.interceptCanvasGraphics(
        pdfPage,
        this.transUIManager.renderCacheKey,
        ctx,
        id,
      )
      // 如果当前渲染队列不是最高优先级，则暂停渲染
      if (this.renderingQueue && !this.renderingQueue.isHighestPriority(this)) {
        this.renderingState = RenderingStates.PAUSED
        this.resume = () => {
          this.renderingState = RenderingStates.RUNNING
          cont()
        }
        return
      }
      cont()
    }

    const ctx = canvas.getContext('2d', {
      alpha: true,
      willReadFrequently: true,
    })!

    const devicePixelRatio =
      window.devicePixelRatio || PixelsPerInch.PDF_TO_CSS_UNITS
    canvas.width = width * devicePixelRatio
    canvas.height = height * devicePixelRatio

    // this.viewportMap.set(canvas, this.viewport)

    const renderTask = (this.renderTask = pdfPage.render({
      canvasContext: ctx,
      intent: this.transUIManager.intent,
      transform: [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0],
      viewport: this.viewport,
    }))

    renderTask.onContinue = renderContinueCallback

    const resultPromise = renderTask.promise.then(
      () => {
        showCanvas?.(true)
        interceptor?.()
        this.transEditorLayerBuilder ||= new PDFTransEditorLayerBuilder({
          id: this.id,
          eventBus: this.eventBus,
          transUIManager: this.transUIManager,
          pdfPage: this.pdfPage!,
          viewport: this.viewport,
          transPageView: this,
          onAppend: (transEditorLayerDiv) => {
            this.addLayer(transEditorLayerDiv, 'transEditorLayer')
          },
        })
        // this.ocrLayer ||= new PDFTransOCRLayer({
        //   id: this.id,
        //   pdfPage,
        //   eventBus: this.eventBus,
        //   transUIManager: this.transUIManager,
        //   pdfViewer: this.pdfViewer,
        //   pdfTransPage: this,
        //   onAppend: (ocrButtonDiv) => {
        //     this.addLayer(ocrButtonDiv, 'ocrButton')
        //   },
        // })
        this.renderTransEditorLayer()
        this.renderOCRLayer()
        this.finishRenderTask(renderTask)
      },
      (error) => {
        if (!(error instanceof RenderingCancelledException)) {
          showCanvas(true)
        }
        interceptor?.()
        return this.finishRenderTask(renderTask, error)
      },
    )
    this.eventBus.emit(PDFTransViewerEvents.PageRender, {
      source: this,
      pageNumber: this.id,
    })
    return resultPromise
  }

  private async renderTransEditorLayer() {
    try {
      await this.transEditorLayerBuilder?.render(this.viewport)
    } catch (error) {
      console.error('renderTransEditorLayer error', error)
    } finally {
      // TODO: 发布事件
      // this.transEditorLayer?.show()
    }
  }

  private renderOCRLayer() {
    if (!this.ocrLayer) {
      return
    }
    try {
      this.ocrLayer.render()
    } catch (error) {
      console.error('renderOCRLayer error', error)
    }
  }

  private async finishRenderTask(
    renderTask: RenderTask,
    error: Error | null = null,
  ) {
    if (renderTask == this.renderTask) {
      this.renderTask = null
    }

    if (error instanceof RenderingCancelledException) {
      this.renderError = null
      return
    }
    this.setDataLoaded(true)

    this.renderError = error

    this.renderingState = RenderingStates.FINISHED

    this.eventBus.emit(PDFTransViewerEvents.PageRendered, {
      source: this,
      pageNumber: this.id,
      cssTransform: false,
      timestamp: performance.now(),
      error: this.renderError,
    })

    if (error) {
      throw error
    }
  }

  private reset({
    keepCanvas = false,
    keepOcrButton = false,
    keepTransEditorLayer = false,
    cancelExtraDelay = 0,
  } = {}) {
    if (!this.div) {
      return
    }
    this.cancelRendering({
      keepTransEditorLayer,
      cancelExtraDelay,
    })
    this.renderingState = RenderingStates.INITIAL
    this._status = TranslationStatus.Default
    const div = this.div
    const childNodes = div.childNodes
    const canvasNode = (keepCanvas && this.getLayer('canvas')) || null
    const ocrButtonNode = (keepOcrButton && this.ocrLayer?.div) || null
    const transEditorLayerNode =
      (keepTransEditorLayer && this.transEditorLayerBuilder?.div) || null
    for (let i = childNodes.length - 1; i >= 0; i--) {
      const node = childNodes[i]
      switch (node) {
        case canvasNode:
        case ocrButtonNode:
        case transEditorLayerNode:
          continue
      }
      node?.remove()
      const layerIndx = this.layers.indexOf(node as HTMLElement)
      if (layerIndx !== -1) {
        this.layers[layerIndx] = null
      }
    }
  }

  private resetStatusLayers() {
    for (const element of Object.values(this.statusLayers)) {
      element?.remove()
    }
    this.statusLayers = {}
  }

  cancelRendering({
    keepTransEditorLayer = false,
    keepOcrButton = false,
    cancelExtraDelay = 0,
  } = {}) {
    if (this.renderTask) {
      this.renderTask.cancel(cancelExtraDelay)
      this.renderTask = null
    }
    this.resume = null
    if (this.transEditorLayerBuilder && !keepTransEditorLayer) {
      this.transEditorLayerBuilder.cancel()
      this.transEditorLayerBuilder = null
    }
    if (this.ocrLayer && !keepOcrButton) {
      this.ocrLayer.cancel()
      this.ocrLayer = null
    }
  }

  update(
    updateArgs: {
      scale?: number
      drawingDelay?: number
    } = {},
  ) {
    const { scale = 0, drawingDelay = -1 } = updateArgs
    this.scale = scale || this.scale
    this.viewport = this.viewport.clone({
      scale: this.scale * PixelsPerInch.PDF_TO_CSS_UNITS,
    })
    this.setDimensions()
    this.reset({
      keepCanvas: true,
      keepOcrButton: true,
      keepTransEditorLayer: true,
    })
  }

  destroy() {
    this.eventBus.emit(PDFTransViewerEvents.PageDestroy, {
      source: this,
      pageNumber: this.id,
    })
    this.reset()
    this.resetStatusLayers()
  }

  show(parent: HTMLElement, isForceTranslating = false) {
    this.setDimensions()
    parent.append(this.div)
    this.transUIManager.extractTexts(isForceTranslating)
    this.div.hidden = false
    this.ocrLayer?.show()
  }

  hide() {
    this.destroy()
    this.div.remove()
    this.div.hidden = true
    this.div.textContent = ''
  }
}
