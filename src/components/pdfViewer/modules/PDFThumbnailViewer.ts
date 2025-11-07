import { type PDFDocumentProxy } from 'pdfjs-dist'
import { type PDFEventBus } from '../events'
import { PDFThumbnailEvent } from '../events/pdfThumbnail'
import {
  getVisibleElements,
  type VisibleElements,
} from '../libs/pdfjs-internal'
import { scrollIntoView } from '../utils/ui'
import { LinkService } from './LinkService'
import { PDFRenderingQueue } from './PDFRenderingQueue'
import { PDFThumbnailView } from './PDFThumbnailView'

interface PDFThumbnailViewerOptions {
  container: HTMLElement
  eventBus: PDFEventBus
  linkService: LinkService
  renderingQueue: PDFRenderingQueue
}

const THUMBNAIL_SCROLL_MARGIN = -12

export class PDFThumbnailViewer {
  private pdfDocument: PDFDocumentProxy | null = null
  private container: HTMLElement
  private eventBus: PDFEventBus
  private linkService: LinkService
  private renderingQueue: PDFRenderingQueue
  private _thumbnails: PDFThumbnailView[] = []
  public currentPageNumber: number
  public _onePageRenderedCapability: PromiseWithResolvers<void> | null = null

  constructor(options: PDFThumbnailViewerOptions) {
    this.container = options.container
    this.eventBus = options.eventBus
    this.linkService = options.linkService
    this.renderingQueue = options.renderingQueue
    this.renderingQueue.setThumbnailViewer(this)
    this.renderingQueue.isThumbnailViewEnabled = true
    this.currentPageNumber = 1
    this._onePageRenderedCapability = null
    this.resetView()
  }

  get thumbnails() {
    return this._thumbnails
  }

  get onePageRenderedCapability() {
    return this._onePageRenderedCapability
  }

  private cancelRendering() {
    for (const thumbnail of this._thumbnails) {
      thumbnail.cancelRendering()
    }
  }

  getThumbnail(pageNumber: number) {
    return this._thumbnails[pageNumber - 1]
  }

  private resetView() {
    this._thumbnails = []
    this.currentPageNumber = 1
    this._onePageRenderedCapability = Promise.withResolvers()
  }

  setDocument(pdfDocument: PDFDocumentProxy | null) {
    if (this.pdfDocument) {
      this.cancelRendering()
      this.resetView()
    }
    this.pdfDocument = pdfDocument
    if (!pdfDocument) {
      return
    }
    const firstPagePromise = pdfDocument.getPage(1)

    const onAfterDraw = () => {
      this._onePageRenderedCapability?.resolve()
      this._onePageRenderedCapability = null
      this.eventBus.off(PDFThumbnailEvent.ThumbnailRendered, onAfterDraw)
    }
    this.eventBus.on(PDFThumbnailEvent.ThumbnailRendered, onAfterDraw)

    firstPagePromise
      .then((firstPdfPage) => {
        const pagesCount = pdfDocument.numPages
        const viewport = firstPdfPage.getViewport({ scale: 1 })
        for (let pageNum = 1; pageNum <= pagesCount; pageNum++) {
          const thumbnail = new PDFThumbnailView({
            id: pageNum,
            eventBus: this.eventBus,
            defaultViewport: viewport.clone(),
            linkService: this.linkService,
            renderingQueue: this.renderingQueue,
          })
          this._thumbnails.push(thumbnail)
        }
        this._thumbnails[0]?.setPdfPage(firstPdfPage)
        this.eventBus.emit(PDFThumbnailEvent.ThumbnailsInit, {
          source: this,
        })
      })
      .catch((reason) => {
        console.error('Unable to initialize thumbnail viewer', reason)
      })
  }

  async scrollThumbnailIntoView(pageNumber: number) {
    if (!this.pdfDocument) return
    const thumbView = this._thumbnails[pageNumber - 1]
    if (!thumbView) {
      console.error('Thumbnail view not found')
      return
    }
    await this._onePageRenderedCapability?.promise
    const { views, first, last } = this.getVisibleThumbs()
    // 判断是否需要滚动
    if (views.length > 0) {
      let shouldScroll = false
      if (
        pageNumber <= (first?.id as number) ||
        pageNumber >= (last?.id as number)
      ) {
        shouldScroll = true
      } else {
        for (const { id, percent } of views) {
          if (id !== pageNumber) {
            continue
          }
          shouldScroll = percent < 100
          break
        }
      }
      if (shouldScroll) {
        scrollIntoView(this.container, thumbView.div, {
          top: THUMBNAIL_SCROLL_MARGIN,
        })
      }
    }
    this.currentPageNumber = pageNumber
  }

  private getVisibleThumbs() {
    return getVisibleElements({
      scrollEl: this.container,
      views: this._thumbnails,
    })
  }

  public scrollUpdated() {
    this.renderingQueue.renderHighestPriority()
  }

  private getScrollAhead(visible: VisibleElements<PDFThumbnailView>) {
    if (visible.last?.id === this._thumbnails.length) {
      return false
    }
    return true
  }

  private async ensurePdfPageLoaded(thumbView: PDFThumbnailView) {
    if (thumbView.pdfPage) {
      return thumbView.pdfPage
    }
    try {
      const pdfPage = await this.pdfDocument!.getPage(thumbView.id)
      if (!thumbView.pdfPage) {
        thumbView.setPdfPage(pdfPage)
      }
      return pdfPage
    } catch (reason) {
      console.error('Unable to get page for thumb view', reason)
      return null
    }
  }

  forceRendering() {
    const visibleThumbs = this.getVisibleThumbs()
    const scrollAhead = this.getScrollAhead(visibleThumbs)
    const thumbView = this.renderingQueue.getHighestPriority<PDFThumbnailView>(
      visibleThumbs,
      this._thumbnails,
      scrollAhead,
    )
    if (thumbView) {
      this.ensurePdfPageLoaded(thumbView).then(() => {
        this.renderingQueue.renderView(thumbView)
      })
      return true
    }
    return false
  }
}
