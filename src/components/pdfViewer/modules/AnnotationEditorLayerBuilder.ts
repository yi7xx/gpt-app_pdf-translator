import { type PageViewport, type PDFPageProxy } from 'pdfjs-dist'
import { type PDFEventBus } from '../events'
import { AnnotationEditorLayer } from './AnnotationEditorLayer'
import { AnnotationEditorUIManager } from './AnnotationEditorUIManager'
import { TextLayerBuilder } from './TextLayer'

interface AnnotationEditorLayerOptions {
  pdfPage: PDFPageProxy
  eventBus: PDFEventBus
  textLayer: TextLayerBuilder
  annotationEditorUIManager: AnnotationEditorUIManager
  onAppend: (div: HTMLDivElement) => void
}

export class AnnotationEditorLayerBuilder {
  public div: HTMLDivElement | null
  private pdfPage: PDFPageProxy
  private textLayer: TextLayerBuilder
  private onAppend: (div: HTMLDivElement) => void | null
  private eventBus: PDFEventBus
  private cancelled: boolean
  private annotationEditorLayer: AnnotationEditorLayer | null
  private uiManager: AnnotationEditorUIManager
  private eventAbortController: AbortController

  constructor(options: AnnotationEditorLayerOptions) {
    this.pdfPage = options.pdfPage
    this.textLayer = options.textLayer
    this.onAppend = options.onAppend || null
    this.cancelled = false
    this.div = null
    this.annotationEditorLayer = null
    this.eventBus = options.eventBus
    this.uiManager = options.annotationEditorUIManager
    this.eventAbortController = new AbortController()
  }

  async render(
    viewport: PageViewport,
    drawLayer?: HTMLElement,
    intent: string = 'display',
  ) {
    if (intent !== 'display') {
      return
    }
    if (this.cancelled) {
      return
    }
    const clonedViewport = viewport.clone({ dontFlip: true })
    if (this.div) {
      this.annotationEditorLayer!.setDrawLayer(drawLayer)
      this.annotationEditorLayer!.update({ viewport: clonedViewport })
      this.show()
      return
    }
    const div = (this.div = document.createElement('div'))
    div.className = 'annotationEditorLayer'
    div.hidden = true
    this.onAppend?.(div)

    this.annotationEditorLayer = new AnnotationEditorLayer({
      div,
      parent: this,
      pageIndex: this.pdfPage.pageNumber - 1,
      viewport: clonedViewport,
      textLayer: this.textLayer,
      annotationEditorUIManager: this.uiManager,
      eventBus: this.eventBus,
      signal: this.eventAbortController.signal,
    })
    this.annotationEditorLayer!.setDrawLayer(drawLayer)

    this.annotationEditorLayer.render({
      viewport: clonedViewport,
    })
    this.show()
  }

  cancel() {
    this.cancelled = true
    if (!this.div) {
      return
    }
    this.eventAbortController.abort()
    this.annotationEditorLayer?.destroy()
    this.annotationEditorLayer?.cancelDrawLayer()
  }

  hide() {
    if (!this.div) {
      return
    }
    this.div.hidden = true
  }

  show() {
    if (!this.div) {
      return
    }
    this.div.hidden = false
  }
}
