/* eslint-disable max-lines */
import {
  AbortException,
  RenderingCancelledException,
  type PDFPageProxy,
  type PageViewport,
  type RenderTask,
} from 'pdfjs-dist'
import { DEFAULT_SCALE } from '../constants'
import { PDFPageEvent, type PDFEventBus } from '../events'
import { PixelsPerInch, setLayerDimensions } from '../utils/display'
import { RenderingStates } from '../utils/ui'
import { AnnotationEditorLayerBuilder } from './AnnotationEditorLayerBuilder'
import { AnnotationEditorUIManager } from './AnnotationEditorUIManager'
import { AnnotationLayerBuilder } from './AnnotationLayer'
import { LinkService } from './LinkService'
import { PDFFindController } from './PDFFindController'
import {
  PDFRenderingQueue,
  type PDFRenderingQueueView,
} from './PDFRenderingQueue'
import { PDFViewer, SpreadMode } from './PDFViewer'
import { TextHighlighter } from './TextHighlighter'
import { TextLayerBuilder } from './TextLayer'

interface PDFPageViewOptions {
  id: number
  eventBus: PDFEventBus
  defaultViewport: PageViewport
  scale: number
  annotationEditorUIManager: AnnotationEditorUIManager
  renderingQueue: PDFRenderingQueue
  findController: PDFFindController
  linkService: LinkService
  pdfViewer: PDFViewer
}

const LAYERS_ORDER = new Map([
  ['canvasWrapper', 0],
  ['textLayer', 1],
  ['annotationLayer', 2],
  ['annotationEditorLayer', 3],
])

export class PDFPageView implements PDFRenderingQueueView {
  public id: number
  public renderingId: string
  public pdfPage: PDFPageProxy | null = null
  public scale: number
  public viewport: PageViewport
  public eventBus: PDFEventBus
  public renderTask: RenderTask | null = null
  public div: HTMLDivElement
  public renderingState: RenderingStates = RenderingStates.INITIAL
  public canvas: HTMLCanvasElement | null = null
  public resume: (() => void) | null
  public textLayer: TextLayerBuilder | null = null

  private textHighlighter: TextHighlighter
  private pdfViewer: PDFViewer

  // 优化页面内容的缩放渲染
  public zoomLayer: HTMLDivElement | null = null
  private viewportMap = new WeakMap<HTMLCanvasElement, PageViewport>()
  private layers: (HTMLElement | null)[] = []
  private annotationEditorLayer: AnnotationEditorLayerBuilder | null = null
  private annotationLayer: AnnotationLayerBuilder | null = null
  private renderError: Error | null = null
  private linkService: LinkService
  private annotationEditorUIManager: AnnotationEditorUIManager
  private renderingQueue: PDFRenderingQueue

  constructor(options: PDFPageViewOptions) {
    const defaultViewport = options.defaultViewport

    this.id = options.id
    this.renderingId = `page-${this.id}`
    this.pdfPage = null
    this.scale = options.scale || DEFAULT_SCALE
    this.viewport = defaultViewport
    this.eventBus = options.eventBus
    this.renderTask = null
    this.annotationLayer = null
    this.annotationEditorLayer = null
    this.textLayer = null
    this.zoomLayer = null
    this.linkService = options.linkService
    this.annotationEditorUIManager = options.annotationEditorUIManager
    this.renderingQueue = options.renderingQueue
    this.pdfViewer = options.pdfViewer
    this.resume = null
    this.textHighlighter = new TextHighlighter({
      eventBus: options.eventBus,
      findController: options.findController,
      pageIndex: this.id - 1,
    })

    const div = document.createElement('div')
    div.className = 'pdfPage'
    div.setAttribute('data-page-number', `${this.id}`)
    this.div = div

    this.setDimensions()
  }

  get width() {
    return this.viewport.width
  }

  get height() {
    return this.viewport.height
  }

  private setDimensions() {
    const { viewport } = this
    setLayerDimensions(this.div, viewport, true, false)
  }

  setPdfPage(pdfPage: PDFPageProxy) {
    this.pdfPage = pdfPage
    const { spreadMode } = this.pdfViewer
    this.viewport = pdfPage.getViewport({
      scale: this.scale * PixelsPerInch.PDF_TO_CSS_UNITS,
    })
    if (spreadMode === SpreadMode.READ || spreadMode === SpreadMode.COMPARE) {
      this.setDimensions()
      this.reset()
    }
  }

  private reset({
    keepZoomLayer = false,
    keepAnnotationLayer = false,
    keepAnnotationEditorLayer = false,
    keepTextLayer = false,
  } = {}) {
    this.cancelRendering({
      keepAnnotationLayer,
      keepAnnotationEditorLayer,
      keepTextLayer,
    })
    this.renderingState = RenderingStates.INITIAL

    const div = this.div

    const childNodes = div.childNodes
    const zoomLayerNode = (keepZoomLayer && this.zoomLayer) || null
    const annotationLayerNode =
      (keepAnnotationLayer && this.annotationLayer?.div) || null
    const annotationEditorLayerNode =
      (keepAnnotationEditorLayer && this.annotationEditorLayer?.div) || null
    const textLayerNode = (keepTextLayer && this.textLayer?.div) || null

    for (let i = childNodes.length - 1; i >= 0; i--) {
      const node = childNodes[i]
      switch (node) {
        case zoomLayerNode:
        case annotationLayerNode:
        case annotationEditorLayerNode:
        case textLayerNode:
          continue
      }
      node?.remove()
      const layerIndx = this.layers.indexOf(node as HTMLElement)
      if (layerIndx !== -1) {
        this.layers[layerIndx] = null
      }
    }
    if (annotationLayerNode) {
      this.annotationLayer!.hide()
    }
    if (annotationEditorLayerNode) {
      this.annotationEditorLayer!.hide()
    }
    if (textLayerNode) {
      this.textLayer!.hide()
    }
    if (!zoomLayerNode) {
      if (this.canvas) {
        this.viewportMap.delete(this.canvas)
        this.canvas.width = 0
        this.canvas.height = 0
        this.canvas = null
      }
      this.resetZoomLayer()
    }
  }

  private addLayer(div: HTMLDivElement, name: string) {
    const pos = LAYERS_ORDER.get(name)!
    const oldDiv = this.layers[pos]
    this.layers[pos] = div
    if (oldDiv) {
      oldDiv.replaceWith(div)
      return
    }
    for (let i = pos - 1; i >= 0; i--) {
      const layer = this.layers[i]
      if (layer) {
        layer.after(div)
        return
      }
    }
    this.div.prepend(div)
  }

  async draw() {
    console.log('draw -----------------------', this.id, this.renderingState)
    if (this.renderingState !== RenderingStates.INITIAL) {
      console.error('Must be in new state before drawing')
      this.reset()
    }
    const { div, pdfPage, viewport } = this
    if (!pdfPage) {
      this.renderingState = RenderingStates.FINISHED
      throw new Error('pdfPage is not loaded')
    }
    div.setAttribute('data-loaded', 'false')

    this.renderingState = RenderingStates.RUNNING

    const canvasWrapper = document.createElement('div')
    canvasWrapper.classList.add('canvasWrapper')
    this.addLayer(canvasWrapper, 'canvasWrapper')

    this.textLayer ||= new TextLayerBuilder({
      pdfPage,
      highlighter: this.textHighlighter,
      onAppend: (textLayerDiv) => {
        this.addLayer(textLayerDiv, 'textLayer')
      },
    })

    this.annotationLayer ||= new AnnotationLayerBuilder({
      pdfPage,
      linkService: this.linkService,
      annotationEditorUIManager: this.annotationEditorUIManager,
      onAppend: (annotationLayerDiv) => {
        this.addLayer(annotationLayerDiv, 'annotationLayer')
      },
    })

    const { width, height } = viewport
    const canvas = document.createElement('canvas')
    canvas.setAttribute('role', 'presentation')

    canvas.hidden = true

    canvasWrapper.append(canvas)
    this.canvas = canvas

    let showCanvas = (isLastShow?: boolean) => {
      if (isLastShow) {
        canvas.hidden = false
        // @ts-ignore
        showCanvas = null
      }
    }

    // 渲染继续 只有高优先级渲染队列的渲染任务会继续
    const renderContinueCallback = (cont: () => void) => {
      showCanvas?.(false)
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
      alpha: false,
      willReadFrequently: true,
    })!
    const devicePixelRatio =
      window.devicePixelRatio || PixelsPerInch.PDF_TO_CSS_UNITS
    canvas.width = width * devicePixelRatio
    canvas.height = height * devicePixelRatio

    this.viewportMap.set(canvas, viewport)

    const renderTask = (this.renderTask = pdfPage.render({
      canvasContext: ctx,
      transform: [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0],
      viewport,
    }))

    renderTask.onContinue = renderContinueCallback

    const resultPromise = renderTask.promise.then(
      async () => {
        showCanvas?.(true)
        this.renderTextLayer()
        if (this.annotationLayer) {
          await this.renderAnnotationLayer()
        }
        this.annotationEditorLayer ||= new AnnotationEditorLayerBuilder({
          pdfPage,
          textLayer: this.textLayer!,
          eventBus: this.eventBus,
          annotationEditorUIManager: this.annotationEditorUIManager,
          onAppend: (annotationEditorLayerDiv) => {
            this.addLayer(annotationEditorLayerDiv, 'annotationEditorLayer')
          },
        })
        this.renderAnnotationEditorLayer(canvasWrapper)
        this.finishRenderTask(renderTask)
      },
      (error) => {
        if (!(error instanceof RenderingCancelledException)) {
          showCanvas(true)
        }
        return this.finishRenderTask(renderTask, error)
      },
    )

    this.eventBus.emit(PDFPageEvent.PageRender, {
      source: this,
      pageNumber: this.id,
    })
    return resultPromise
  }

  private async renderAnnotationEditorLayer(canvasWrapper?: HTMLElement) {
    let error = null
    try {
      await this.annotationEditorLayer!.render(
        this.viewport,
        canvasWrapper,
        'display',
      )
    } catch (ex) {
      console.error(`#renderAnnotationEditorLayer: "${ex}".`)
      error = ex as Error
    } finally {
      this.dispatchLayerRendered(
        PDFPageEvent.AnnotationEditorLayerRendered,
        error,
      )
    }
  }

  private async renderAnnotationLayer() {
    let error: Error | null = null
    try {
      await this.annotationLayer!.render(this.viewport)
    } catch (ex) {
      console.error(`#renderAnnotationLayer: "${ex}".`)
      error = ex as Error
    } finally {
      this.dispatchLayerRendered(PDFPageEvent.AnnotationLayerRendered, error)
    }
  }

  private async renderTextLayer() {
    if (!this.textLayer) {
      return
    }
    let error: Error | null = null
    try {
      await this.textLayer.render(this.viewport)
    } catch (ex) {
      if (ex instanceof AbortException) {
        return
      }
      console.error(`renderTextLayer error: ${ex}`)
      error = ex as Error
    } finally {
      this.dispatchLayerRendered(PDFPageEvent.TextLayerRendered, error)
    }
  }

  private dispatchLayerRendered(
    event:
      | PDFPageEvent.TextLayerRendered
      | PDFPageEvent.AnnotationLayerRendered
      | PDFPageEvent.AnnotationEditorLayerRendered,
    error: Error | null,
  ) {
    this.eventBus.emit(event, {
      source: this,
      pageNumber: this.id,
      error,
    })
  }

  private finishRenderTask(renderTask: RenderTask, error: Error | null = null) {
    if (renderTask == this.renderTask) {
      this.renderTask = null
    }

    if (error instanceof RenderingCancelledException) {
      this.renderError = null
      return
    }

    this.div.setAttribute('data-loaded', 'true')

    this.renderError = error

    this.renderingState = RenderingStates.FINISHED
    this.resetZoomLayer(true)
    this.eventBus.emit(PDFPageEvent.PageRendered, {
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

  private resetZoomLayer(removeFromDom = false) {
    if (!this.zoomLayer) {
      return
    }
    const zoomLayerCanvas = this.zoomLayer.firstChild as HTMLCanvasElement
    this.viewportMap.delete(zoomLayerCanvas)
    if (removeFromDom) {
      this.zoomLayer.remove()
    }
    this.zoomLayer = null
  }

  private cssTransform(options: {
    target: HTMLCanvasElement
    redrawAnnotationLayer?: boolean
    redrawAnnotationEditorLayer?: boolean
    redrawTextLayer?: boolean
    hideTextLayer?: boolean
  }) {
    const {
      target,
      redrawAnnotationLayer = false,
      redrawAnnotationEditorLayer = false,
      redrawTextLayer = false,
      hideTextLayer = false,
    } = options
    if (!target.hasAttribute('zooming')) {
      target.setAttribute('zooming', 'true')
      target.style.width = target.style.height = ''
    }
    const originalViewport = this.viewportMap.get(target)
    if (this.viewport !== originalViewport) {
      const scaleX = 1
      const scaleY = 1
      target.style.transform = `scale(${scaleX}, ${scaleY})`
    }

    if (redrawAnnotationLayer && this.annotationLayer) {
      this.renderAnnotationLayer()
    }

    if (redrawAnnotationEditorLayer && this.annotationEditorLayer) {
      this.renderAnnotationEditorLayer()
    }

    if (redrawTextLayer && this.textLayer) {
      this.renderTextLayer()
    }

    if (this.textLayer) {
      if (hideTextLayer) {
        this.textLayer.hide()
      } else if (redrawTextLayer) {
        this.renderTextLayer()
      }
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

    if (this.canvas) {
      const postponeDrawing = drawingDelay >= 0 && drawingDelay < 1000
      if (postponeDrawing) {
        if (
          postponeDrawing &&
          this.renderingState !== RenderingStates.FINISHED
        ) {
          this.cancelRendering({
            keepAnnotationLayer: true,
            keepAnnotationEditorLayer: true,
            keepTextLayer: true,
            cancelExtraDelay: drawingDelay,
          })
          this.renderingState = RenderingStates.FINISHED
        }

        this.cssTransform({
          target: this.canvas,
          redrawAnnotationLayer: true,
          redrawAnnotationEditorLayer: true,
          redrawTextLayer: !postponeDrawing,
          hideTextLayer: postponeDrawing,
        })

        if (postponeDrawing) {
          return
        }

        this.eventBus.emit(PDFPageEvent.PageRendered, {
          source: this,
          pageNumber: this.id,
          cssTransform: true,
          timestamp: performance.now(),
          error: this.renderError,
        })
        return
      }
      if (!this.zoomLayer && !this.canvas.hidden) {
        this.zoomLayer = this.canvas.parentNode as HTMLDivElement
        this.zoomLayer.style.position = 'absolute'
      }
    }
    if (this.zoomLayer) {
      this.cssTransform({
        target: this.zoomLayer.firstChild as HTMLCanvasElement,
      })
    }
    this.reset({
      keepZoomLayer: true,
      keepAnnotationLayer: true,
      keepAnnotationEditorLayer: true,
      keepTextLayer: true,
    })
  }

  destroy() {
    this.eventBus.emit(PDFPageEvent.PageDestroy, {
      source: this,
      pageNumber: this.id,
    })
    this.reset()
    this.textLayer?.destroy()
    this.pdfPage?.cleanup()
  }

  cancelRendering({
    keepAnnotationLayer = false,
    keepAnnotationEditorLayer = false,
    keepTextLayer = false,
    cancelExtraDelay = 0,
  } = {}) {
    if (this.renderTask) {
      this.renderTask.cancel(cancelExtraDelay)
      this.renderTask = null
    }
    this.resume = null

    if (this.textLayer && (!keepTextLayer || !this.textLayer.div)) {
      this.textLayer.cancel()
      this.textLayer = null
    }
    if (
      this.annotationLayer &&
      (!keepAnnotationLayer || !this.annotationLayer.div)
    ) {
      this.annotationLayer.cancel()
      this.annotationLayer = null
    }
    if (
      this.annotationEditorLayer &&
      (!keepAnnotationEditorLayer || !this.annotationEditorLayer.div)
    ) {
      this.annotationEditorLayer.cancel()
      this.annotationEditorLayer = null
    }
  }

  show(parent: HTMLElement) {
    this.div.hidden = false
    this.setDimensions()
    parent.appendChild(this.div)
  }

  hide() {
    this.destroy()
    this.div.remove()
    this.div.hidden = true
    this.div.textContent = ''
  }
}
