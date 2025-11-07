/* eslint-disable max-lines */
import { type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist'
import {
  DEFAULT_SCALE,
  DEFAULT_SCALE_DELTA,
  DEFAULT_SCALE_VALUE,
  MAX_AUTO_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  SCROLLBAR_PADDING,
  UNKNOWN_SCALE,
  VERTICAL_PADDING,
} from '../constants'
import {
  PDFPageEvent,
  PDFTransViewerEvents,
  PDFViewerEvent,
  type PDFEventBus,
} from '../events'
import {
  getVisibleElements,
  type VisibleElements,
} from '../libs/pdfjs-internal'
import { TranslationServiceManager } from '../services/TranslationServiceManager'
import { PixelsPerInch } from '../utils/display'
import { ScaleMode, isPortraitOrientation, scrollIntoView } from '../utils/ui'
import { AnnotationEditorUIManager } from './AnnotationEditorUIManager'
import { LinkService } from './LinkService'
import { PDFFindController } from './PDFFindController'
import { PDFPageView } from './PDFPageView'
import { PDFPageViewBuffer } from './PDFPageViewBuffer'
import {
  PDFRenderingQueue,
  type PDFRenderingQueueView,
} from './PDFRenderingQueue'
import { PDFTransPageView } from './PDFTransPageView'
import { PDFTransViewerUIManager } from './PDFTransViewerUIManager'
import { Highlight } from './highlight'

interface PDFViewerOptions {
  version: string
  container: HTMLDivElement
  viewer: HTMLDivElement
  linkService: LinkService
  eventBus: PDFEventBus
  findController: PDFFindController
  renderingQueue: PDFRenderingQueue
  spreadMode: SpreadMode
  translationService: TranslationServiceManager
  i18n: Record<string, string>
}

interface SetScaleOptions {
  noScroll?: boolean
  preset?: boolean
  drawingDelay?: number
  forceScale?: boolean
}

// 扩展模式
export enum SpreadMode {
  // 阅读模式
  READ = 'read',
  // 对比模式，且翻译模式
  COMPARE = 'compare',
  // 翻译模式
  TRANSLATE = 'translate',
}

const PagesCountLimit = {
  FORCE_SCROLL_MODE_PAGE: 10000,
  FORCE_LAZY_PAGE_INIT: 5000,
  PAUSE_EAGER_PAGE_INIT: 250,
}

// 最大缓存pageView数量
const DEFAULT_CACHE_SIZE = 10

export class PDFViewer {
  public container: HTMLDivElement
  public viewer: HTMLDivElement
  public linkService: LinkService
  public eventBus: PDFEventBus
  public pdfDocument: PDFDocumentProxy | null = null
  public findController: PDFFindController
  public i18n: Record<string, string>
  private translationService: TranslationServiceManager
  private _version: string
  private _pages: PDFPageView[] = []
  private _transPages: PDFTransPageView[] = []
  private _currentPageNumber: number = 1
  private _scrollDown: boolean = true
  // 是否翻译打印
  private _isPrinting: boolean = false

  // 计算后：当前页面的缩放
  private _currentScale: number = UNKNOWN_SCALE
  // 计算前：当前页面的缩放值
  private _currentScaleValue: string | null = null

  // 第一个页面加载完成时
  private _firstPageCapability: PromiseWithResolvers<PDFPageProxy> | null = null
  // 所有页面加载完成时
  private _pagesCapability: PromiseWithResolvers<void> | null = null
  // 任意页面渲染完成时
  private _onePageRenderedCapability: PromiseWithResolvers<{
    timestamp: number
  }> | null = null

  private scaleTimeoutId: NodeJS.Timeout | null = null

  public uiManager: AnnotationEditorUIManager | null = null

  public transUIManager: PDFTransViewerUIManager | null = null

  // 扩展模式
  private _spreadMode: SpreadMode = SpreadMode.READ
  // 默认扩展模式
  private _defaultSpreadMode: SpreadMode = SpreadMode.READ

  // 优化加载策略
  private buffer
  private renderingQueue: PDFRenderingQueue

  // 取消事件订阅
  private eventAbortController: AbortController | null = null

  constructor(options: PDFViewerOptions) {
    this._version = options.version
    this.container = options.container
    this.viewer = options.viewer
    this.linkService = options.linkService
    this.eventBus = options.eventBus
    this.renderingQueue = options.renderingQueue
    this.uiManager = null
    this.findController = options.findController
    this._spreadMode = options.spreadMode
    this.i18n = options.i18n
    this.translationService = options.translationService
    this._defaultSpreadMode = options.spreadMode
    this.renderingQueue.setViewer(this)
    this.buffer = null as any
    this.resetView()
  }

  get version() {
    return this._version
  }

  get firstPagePromise() {
    return this.pdfDocument ? this._firstPageCapability!.promise : null
  }

  get onePageRendered() {
    return this.pdfDocument ? this._onePageRenderedCapability!.promise : null
  }

  get pagesPromise() {
    return this.pdfDocument ? this._pagesCapability!.promise : null
  }

  get pagesCount() {
    return this._pages.length
  }

  get currentPageNumber() {
    return this._currentPageNumber
  }

  get isPrinting() {
    return this._isPrinting
  }

  set isPrinting(value) {
    this._isPrinting = value
    this.eventBus.emit(PDFViewerEvent.PrintingChanged, {
      source: this,
      isPrinting: value,
    })
  }

  set currentPageNumber(val: number) {
    if (!this.pdfDocument) {
      return
    }
    if (!this.setCurrentPageNumber(val, true)) {
      console.error(`currentPageNumber ${val} is not valid page.`)
    }
  }

  get spreadMode() {
    return this._spreadMode
  }

  set spreadMode(mode: SpreadMode) {
    if (!this.translationService.globalEnableTranslate) {
      return
    }
    if (this._spreadMode === mode) {
      return
    }
    this._spreadMode = mode
    this.eventBus.emit(PDFViewerEvent.SpreadModeChanged, {
      source: this,
      mode,
    })
    this.updateSpreadMode(this.currentPageNumber)
  }

  get currentScale(): number {
    return this._currentScale !== UNKNOWN_SCALE
      ? this._currentScale
      : DEFAULT_SCALE
  }

  set currentScale(val: number | string) {
    if (typeof val === 'number' && isNaN(Number(val))) {
      throw new Error('currentScale must be a number')
    }
    if (!this.pdfDocument) {
      return
    }
    this.setScale(val, { noScroll: false })
  }

  get currentScaleValue(): string | null {
    return this._currentScaleValue
  }

  set currentScaleValue(val: number | string) {
    if (!this.pdfDocument) {
      return
    }
    this.setScale(val, { noScroll: false })
  }

  get isTranslateMode() {
    return this._spreadMode === SpreadMode.TRANSLATE
  }

  get isReaderMode() {
    return this._spreadMode === SpreadMode.READ
  }

  get isCompareMode() {
    return this._spreadMode === SpreadMode.COMPARE
  }

  get pages() {
    return this._pages
  }

  get transPages() {
    return this._transPages
  }

  get views() {
    return this.isTranslateMode ? this._transPages : this._pages
  }

  private get pageWidthScaleFactor() {
    if (this._spreadMode === SpreadMode.COMPARE) {
      return 2
    }
    return 1
  }

  get scrollDown() {
    return this._scrollDown
  }

  getPageView(pageNumber: number) {
    return this._pages[pageNumber - 1]
  }

  getTransPageView(pageNumber: number) {
    return this._transPages[pageNumber - 1]
  }

  private setScaleUpdatePages(
    newScale: number,
    newValue: string | number,
    options: SetScaleOptions,
  ) {
    const {
      noScroll = false,
      preset = false,
      drawingDelay = -1,
      forceScale = false,
    } = options
    this._currentScaleValue = `${newValue}`
    const isSameScale =
      newScale === this._currentScale ||
      Math.abs(newScale - this._currentScale) < 1e-15

    if (!forceScale && isSameScale) {
      if (preset) {
        this.eventBus.emit(PDFViewerEvent.ScaleChanging, {
          source: this,
          scale: newScale,
          presetValue: newValue,
        })
      }
      return
    }

    this.viewer.style.setProperty(
      '--scale-factor',
      `${newScale * PixelsPerInch.PDF_TO_CSS_UNITS}`,
    )

    // 是否延迟绘制
    const postponeDrawing = drawingDelay >= 0 && drawingDelay < 1000

    // 刷新视图
    this.refresh(true, {
      scale: newScale,
      drawingDelay: postponeDrawing ? drawingDelay : -1,
    })

    if (postponeDrawing) {
      this.scaleTimeoutId = setTimeout(() => {
        this.scaleTimeoutId = null
        // 强制刷新
        this.refresh()
      }, drawingDelay)
    }

    const previousScale = this._currentScale
    this._currentScale = newScale

    if (!noScroll) {
      const page = this._currentPageNumber
      this.scrollPageIntoView({ pageNumber: page })
    }
    this.eventBus.emit(PDFViewerEvent.ScaleChanging, {
      source: this,
      scale: newScale,
      presetValue: preset ? previousScale : undefined,
    })
  }

  updateScale(options: { drawingDelay?: number; steps: number }) {
    const { drawingDelay } = options
    let steps = options.steps
    if (steps === null) {
      throw new Error(
        'Invalid updateScale options: either `steps` must be provided.',
      )
    }
    if (!this.pdfDocument) {
      return
    }
    let newScale = this._currentScale
    const delta = steps > 0 ? DEFAULT_SCALE_DELTA : 1 / DEFAULT_SCALE_DELTA
    const round = steps > 0 ? Math.ceil : Math.floor
    steps = Math.abs(steps)
    do {
      newScale = round(Number((newScale * delta).toFixed(2)) * 10) / 10
    } while (--steps > 0)
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale))
    this.setScale(newScale, { noScroll: false, drawingDelay })
  }

  private setScale(val: string | number, options: SetScaleOptions = {}) {
    let scale = typeof val === 'number' ? val : parseFloat(val)
    if (scale > 0) {
      options.preset = false
      this.setScaleUpdatePages(scale, val, options)
    } else {
      const currentPage = this.views[this._currentPageNumber - 1]
      if (!currentPage) {
        return
      }

      let xPadding = SCROLLBAR_PADDING
      const yPadding = VERTICAL_PADDING

      if (this._spreadMode === SpreadMode.COMPARE) {
        xPadding = 12
      }

      const parent = this.viewer.parentElement as HTMLDivElement

      const pageWidthScale =
        (((parent.clientWidth - xPadding) / currentPage.width) *
          currentPage.scale) /
        this.pageWidthScaleFactor
      const pageHeightScale =
        ((this.container.clientHeight - yPadding) / currentPage.height) *
        currentPage.scale

      switch (val) {
        case ScaleMode.PAGE_ACTUAL:
          scale = 1
          break
        case ScaleMode.PAGE_WIDTH:
          scale = pageWidthScale
          break
        case ScaleMode.PAGE_HEIGHT:
          scale = pageHeightScale
          break
        case ScaleMode.PAGE_FIT:
          scale = Math.min(pageWidthScale, pageHeightScale)
          break
        case ScaleMode.AUTO:
          const horizontalScale = isPortraitOrientation(currentPage)
            ? pageWidthScale
            : Math.min(pageHeightScale, pageWidthScale)
          scale = Math.min(MAX_AUTO_SCALE, horizontalScale)
          break
        default:
          console.error(`#setScale: "${val}" is an unknown zoom value.`)
          return
      }
      options.preset = true
      this.setScaleUpdatePages(scale, val, options)
    }
  }

  private resetCurrentPageView() {
    const view = this.views[this._currentPageNumber - 1]
    if (!view) return
    this.scrollIntoView(view)
  }

  private setCurrentPageNumber(val: number, resetCurrentPageView = false) {
    if (this._currentPageNumber === val) {
      if (resetCurrentPageView) {
        this.resetCurrentPageView()
      }
      return true
    }
    if (!(0 < val && val <= this.pagesCount)) {
      return false
    }
    const previous = this._currentPageNumber
    this._currentPageNumber = val

    this.eventBus.emit(PDFViewerEvent.PageChanging, {
      source: this,
      pageNumber: val,
      previous,
    })

    if (resetCurrentPageView) {
      this.resetCurrentPageView()
    }

    return true
  }

  private scrollIntoView(
    pageView: PDFPageView | PDFTransPageView,
    spot: { top?: number } = {},
  ) {
    const { div, id } = pageView

    if (this._currentPageNumber !== id) {
      this.setCurrentPageNumber(id)
    }
    scrollIntoView(this.container, div, { ...spot, isPageScroll: true })
  }

  scrollPageIntoView(options: {
    pageNumber: number
    scale?: string | number
    top?: number
  }) {
    const { pageNumber, scale, top } = options
    if (!this.pdfDocument) {
      return
    }
    const pageView = this.views[pageNumber - 1]
    if (!pageView) {
      return
    }

    if (typeof scale === 'undefined') {
      this.setCurrentPageNumber(pageNumber, true)
      return
    }

    // @ts-ignore
    if (scale && scale !== this._currentScale) {
      this.currentScaleValue = scale
    } else if (this._currentScale === UNKNOWN_SCALE) {
      this.currentScaleValue = DEFAULT_SCALE_VALUE
    }

    this.scrollIntoView(pageView, { top })
  }

  scrollHighlightIntoView(highlight: Pick<Highlight, 'pageIndex' | 'boxes'>) {
    const pageNumber = highlight.pageIndex + 1
    const pageView = this.getPageView(pageNumber)
    if (!pageView) {
      this.linkService.goToPage(pageNumber)
      return
    }
    const height = pageView.height
    const { y } = highlight.boxes[0]!
    const top = y * height
    scrollIntoView(this.container, pageView.div, {
      top: top / 2,
      isPageScroll: true,
    })
  }

  private cancelRendering() {
    if (this.isReaderMode || this.isCompareMode) {
      for (const pdfView of this._pages) {
        pdfView.cancelRendering()
      }
    }
    if (this.isTranslateMode || this.isCompareMode) {
      for (const pdfView of this._transPages) {
        pdfView.cancelRendering()
      }
    }
  }

  private resetView() {
    this._pages = []
    this._transPages = []
    this._currentPageNumber = 1
    this._currentScale = UNKNOWN_SCALE
    this._currentScaleValue = null
    this._isPrinting = false
    this._firstPageCapability = Promise.withResolvers()
    this._pagesCapability = Promise.withResolvers()
    this._onePageRenderedCapability = Promise.withResolvers()
    this.eventAbortController?.abort()
    this.buffer = new PDFPageViewBuffer(DEFAULT_CACHE_SIZE, this)
    this._spreadMode = this._defaultSpreadMode

    // remove all pages
    this.viewer.textContent = ''
  }

  setDocument(pdfDocument: PDFDocumentProxy | null) {
    if (this.pdfDocument) {
      this.eventBus.emit(PDFViewerEvent.PagesDestroy, { source: this })
      this.cancelRendering()
      this.resetView()
      this.findController.setDocument(null)
      this.uiManager?.destroy()
      this.uiManager = null
      this.transUIManager?.destroy()
      this.transUIManager = null
    }

    this.pdfDocument = pdfDocument
    if (!pdfDocument) {
      return
    }

    const pagesCount = pdfDocument.numPages
    const firstPagePromise = pdfDocument.getPage(1)

    this.findController.setDocument(pdfDocument)

    this.eventAbortController = new AbortController()
    const { signal } = this.eventAbortController

    this._pagesCapability!.promise.then((res) => {
      this.eventBus.emit(PDFViewerEvent.PagesLoaded, {
        source: this,
        pagesCount,
      })
    })

    const onBeforeDraw = (evt: {
      pageNumber: number
      source: PDFPageView | PDFTransPageView
    }) => {
      const isTransPage = evt.source instanceof PDFTransPageView
      // 非独立翻译模式下，翻译页不参与缓存策略
      if (!this.isTranslateMode && isTransPage) {
        return
      }
      const view = this.views[evt.pageNumber - 1]
      if (!view) {
        return
      }
      this.buffer.push(view)
    }
    this.eventBus.on(PDFPageEvent.PageRender, onBeforeDraw, { signal })
    this.eventBus.on(PDFTransViewerEvents.PageRender, onBeforeDraw, { signal })

    const onAfterDraw = (evt: { timestamp: number; cssTransform: boolean }) => {
      if (evt.cssTransform) {
        return
      }
      this._onePageRenderedCapability!.resolve({ timestamp: evt.timestamp })

      this.eventBus.off(PDFPageEvent.PageRendered, onAfterDraw)
      this.eventBus.off(PDFTransViewerEvents.PageRendered, onAfterDraw)
    }
    this.eventBus.on(PDFPageEvent.PageRendered, onAfterDraw, { signal })
    this.eventBus.on(PDFTransViewerEvents.PageRendered, onAfterDraw, {
      signal,
    })

    firstPagePromise.then((firstPdfPage) => {
      if (pdfDocument !== this.pdfDocument) {
        return
      }
      this._firstPageCapability?.resolve(firstPdfPage)

      this.uiManager = new AnnotationEditorUIManager({
        container: this.viewer,
        viewer: this.viewer,
        pdfViewer: this,
        eventBus: this.eventBus,
        pdfDocument,
        linkService: this.linkService,
        findController: this.findController,
      })

      this.transUIManager = new PDFTransViewerUIManager({
        eventBus: this.eventBus,
        translationService: this.translationService,
        pdfDocument,
        pdfViewer: this,
        linkService: this.linkService,
      })

      const scale = this.currentScale
      const viewport = firstPdfPage.getViewport({
        scale: scale * PixelsPerInch.PDF_TO_CSS_UNITS,
      })

      this.viewer.style.setProperty('--scale-factor', `${viewport.scale}`)

      for (let pageNum = 1; pageNum <= pagesCount; pageNum++) {
        const pageView = new PDFPageView({
          id: pageNum,
          pdfViewer: this,
          eventBus: this.eventBus,
          linkService: this.linkService,
          findController: this.findController,
          defaultViewport: viewport.clone({ dontFlip: true }),
          annotationEditorUIManager: this.uiManager,
          renderingQueue: this.renderingQueue,
          scale,
        })
        this._pages.push(pageView)
      }

      for (let pageNum = 1; pageNum <= pagesCount; pageNum++) {
        const transPageView = new PDFTransPageView({
          id: pageNum,
          pdfViewer: this,
          eventBus: this.eventBus,
          linkService: this.linkService,
          defaultViewport: viewport.clone({ dontFlip: true }),
          transUIManager: this.transUIManager,
          renderingQueue: this.renderingQueue,
          scale,
        })
        this._transPages.push(transPageView)
      }

      this._pages[0]?.setPdfPage(firstPdfPage)
      this._transPages[0]?.setPdfPage(firstPdfPage)
      if (this.translationService.globalEnableTranslate) {
        this.updateSpreadMode()
      }
      this._onePageRenderedCapability!.promise.then(async () => {
        if (pdfDocument !== this.pdfDocument) {
          return
        }
        let getPagesLeft = pagesCount - 1

        if (getPagesLeft <= 0) {
          this._pagesCapability!.resolve()
          return
        }
        for (let pageNum = 2; pageNum <= pagesCount; pageNum++) {
          const promise = pdfDocument.getPage(pageNum).then(
            (pdfPage) => {
              const pageView = this._pages[pageNum - 1]!
              const transPageView = this._transPages[pageNum - 1]!
              if (!pageView) return
              if (!pageView.pdfPage) {
                pageView.setPdfPage(pdfPage)
              }
              if (!transPageView.pdfPage) {
                transPageView.setPdfPage(pdfPage)
              }
              if (--getPagesLeft <= 0) {
                this._pagesCapability!.resolve()
              }
            },
            (reason) => {
              console.error(
                `Unable to get page ${pageNum} to initialize viewer`,
                reason,
              )
              if (--getPagesLeft <= 0) {
                this._pagesCapability!.resolve()
              }
            },
          )
          if (pageNum % PagesCountLimit.PAUSE_EAGER_PAGE_INIT === 0) {
            await promise
          }
        }
      }).catch((reason) => {
        console.error('Unable to initialize viewer', reason)
        this._pagesCapability!.reject(reason)
      })
      this.eventBus.emit(PDFViewerEvent.PagesInit, { source: this })
    })
  }

  resetSpreadMode(spreadMode: SpreadMode, isForceTranslating = false) {
    this._spreadMode = spreadMode
    this.eventBus.emit(PDFViewerEvent.SpreadModeChanged, {
      source: this,
      mode: spreadMode,
    })
    if (isForceTranslating) {
      this.transUIManager!.resetTranslationStates()
    }
    for (const transPageView of this._transPages) {
      transPageView.destroy()
    }
    this.updateSpreadMode(this._currentPageNumber, isForceTranslating)
  }

  // 获取翻译页面的原始尺寸
  getTransPagesOverview() {
    return new Promise<
      ({
        width: number
        height: number
        scale: number
        rotation: number
      } | null)[]
    >((resolve) => {
      let initialOrientation: boolean
      const pagesOverview = this._transPages.map(async (transPageView) => {
        const pdfPage = await this.ensurePdfPageLoaded(transPageView)
        if (!pdfPage) {
          return null
        }
        const viewport = pdfPage.getViewport({ scale: 1 })
        const orientation = isPortraitOrientation(viewport)
        if (initialOrientation === undefined) {
          initialOrientation = orientation
        } else if (orientation !== initialOrientation) {
          return {
            width: viewport.height,
            height: viewport.width,
            rotation: (viewport.rotation - 90) % 360,
            scale: viewport.scale,
          }
        }
        return {
          width: viewport.width,
          height: viewport.height,
          rotation: viewport.rotation,
          scale: viewport.scale,
        }
      })
      resolve(Promise.all(pagesOverview))
    })
  }

  private updateSpreadMode(pageNumber?: number, isForceTranslating = false) {
    const viewer = this.viewer

    viewer.textContent = ''
    viewer.classList.remove('pdfTransCompare', 'pdfEnableTranslate')

    const pageCounts = this._pages.length
    if (this._spreadMode === SpreadMode.READ) {
      for (let numPage = 1; numPage <= pageCounts; numPage++) {
        const pageView = this._pages[numPage - 1]!
        const pageTransView = this._transPages[numPage - 1]!
        pageTransView.hide()
        pageView.show(viewer)
      }
    } else if (this._spreadMode === SpreadMode.TRANSLATE) {
      for (let numPage = 1; numPage <= pageCounts; numPage++) {
        const pageView = this._pages[numPage - 1]!
        const pageTransView = this._transPages[numPage - 1]!
        pageView.hide()
        pageTransView.show(viewer, isForceTranslating)
      }
      viewer.classList.add('pdfEnableTranslate')
    } else if (this._spreadMode === SpreadMode.COMPARE) {
      const fragment = document.createDocumentFragment()
      for (let numPage = 1; numPage <= pageCounts; numPage++) {
        const spread = document.createElement('div')
        spread.className = 'pdfSpread'
        const pageView = this._pages[numPage - 1]!
        const pageTransView = this._transPages[numPage - 1]!
        pageView.show(spread)
        pageTransView.show(spread, isForceTranslating)
        fragment.append(spread)
      }
      viewer.append(fragment)
      viewer.classList.add('pdfTransCompare', 'pdfEnableTranslate')
    }

    if (!pageNumber) {
      return
    }

    // 强制设置缩放
    if (this._currentScaleValue) {
      this.setScale(this._currentScaleValue, {
        noScroll: true,
        forceScale: true,
      })
    }
    this.setCurrentPageNumber(pageNumber, true)
    this.update()
  }

  updateViewer(options: { container: HTMLDivElement; viewer: HTMLDivElement }) {
    this.container = options.container
    this.viewer = options.viewer
  }

  getVisiblePages() {
    const views = this.views
    const visibleElements = getVisibleElements<PDFRenderingQueueView>({
      scrollEl: this.container,
      views: views,
      sortByVisibility: true,
    })
    return visibleElements
  }

  async update() {
    if (this.pagesCount === 0) {
      return
    }
    const visible = this.getVisiblePages()
    const visiblePages = visible.views
    const numVisiblePages = visiblePages.length
    if (numVisiblePages === 0) {
      return
    }
    const newCacheSize = Math.max(DEFAULT_CACHE_SIZE, 2 * numVisiblePages + 1)
    this.buffer.resize(newCacheSize, visible.ids)
    this.renderingQueue.renderHighestPriority(visible)

    const currentId = this._currentPageNumber
    let stillFullyVisible = false
    for (const { id, percent } of visiblePages) {
      if (percent < 100) {
        break
      }
      if (id === currentId) {
        stillFullyVisible = true
        break
      }
    }
    this.setCurrentPageNumber(
      stillFullyVisible ? currentId : visiblePages[0]!.id,
    )
    this.eventBus.emit(PDFViewerEvent.UpdateViewArea, {
      source: this,
      visible,
    })
  }

  private async ensurePdfPageLoaded(pageView: PDFPageView | PDFTransPageView) {
    if (pageView.pdfPage) {
      return pageView.pdfPage
    }
    try {
      const pdfPage = await this.pdfDocument!.getPage(pageView.id)
      if (!pageView.pdfPage) {
        pageView.setPdfPage(pdfPage)
      }
      return pdfPage
    } catch (reason) {
      console.error('Unable to get page for page view', reason)
      return null
    }
  }

  private getScrollAhead(visible: VisibleElements<PDFRenderingQueueView>) {
    if (visible.first?.id === 1) {
      return true
    }
    if (visible.last?.id === this.pagesCount) {
      return false
    }
    return this._scrollDown
  }

  setScrollDown(isScrollingDown: boolean) {
    this._scrollDown = isScrollingDown
  }

  destroyView(view: PDFPageView | PDFTransPageView) {
    if (this.isCompareMode) {
      this._transPages[view.id - 1]!.destroy()
    }
    view.destroy()
  }

  forceRendering(
    currentlyVisiblePages?: VisibleElements<PDFRenderingQueueView>,
  ) {
    const visiblePages = currentlyVisiblePages || this.getVisiblePages()
    const scrollAhead = this.getScrollAhead(visiblePages)

    const pageView =
      this.renderingQueue.getHighestPriority<PDFRenderingQueueView>(
        visiblePages,
        this.views,
        scrollAhead,
        false,
      )

    if (pageView) {
      this.ensurePdfPageLoaded(pageView as PDFPageView | PDFTransPageView).then(
        () => {
          this.renderingQueue.renderView(pageView)
          // 翻译模式下，翻译页需要渲染
          if (this.isCompareMode) {
            this.renderingQueue.renderView(this._transPages[pageView.id - 1]!)
          }
        },
      )
      return true
    }
    return false
  }

  refresh(
    noUpdate = false,
    updateArgs: {
      scale?: number
      drawingDelay?: number
    } = {},
  ) {
    if (!this.pdfDocument) {
      return
    }
    // 对比翻译模式下，翻译页需要更新
    if (this.isCompareMode) {
      for (const transPageView of this._transPages) {
        transPageView.update(updateArgs)
      }
    }
    for (const view of this.views) {
      view.update(updateArgs)
    }
    if (this.scaleTimeoutId !== null) {
      clearTimeout(this.scaleTimeoutId)
      this.scaleTimeoutId = null
    }
    if (!noUpdate) {
      this.update()
    }
  }
}
