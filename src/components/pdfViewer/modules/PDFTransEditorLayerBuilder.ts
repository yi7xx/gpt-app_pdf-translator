import { type PageViewport, type PDFPageProxy } from 'pdfjs-dist'
import { type PDFEventBus } from '../events'
import { PDFTransEditorLayer } from './PDFTransEditorLayer'
import { PDFTransPageView } from './PDFTransPageView'
import { PDFTransViewerUIManager } from './PDFTransViewerUIManager'

interface PDFTransEditorLayerBuilderProps {
  id: number
  pdfPage: PDFPageProxy
  eventBus: PDFEventBus
  transUIManager: PDFTransViewerUIManager
  viewport: PageViewport
  transPageView: PDFTransPageView
  onAppend?: (div: HTMLDivElement) => void
}

export class PDFTransEditorLayerBuilder {
  private id: number
  public div: HTMLDivElement | null = null
  private pdfPage: PDFPageProxy
  private eventBus: PDFEventBus
  private transUIManager: PDFTransViewerUIManager
  private cancelled: boolean
  private onAppend: ((div: HTMLDivElement) => void) | null
  private transEditorLayer: PDFTransEditorLayer | null = null
  private transPageView: PDFTransPageView

  constructor(props: PDFTransEditorLayerBuilderProps) {
    this.id = props.id
    this.pdfPage = props.pdfPage
    this.eventBus = props.eventBus
    this.transUIManager = props.transUIManager
    this.div = null
    this.cancelled = false
    this.transPageView = props.transPageView
    this.onAppend = props.onAppend || null
  }

  async render(viewport: PageViewport) {
    if (this.cancelled) {
      return
    }
    const clonedViewport = viewport.clone({ dontFlip: true })
    if (this.div) {
      this.transEditorLayer!.update(clonedViewport)
      this.show()
      return
    }
    const div = (this.div = document.createElement('div'))
    div.className = 'transEditorLayer'
    div.hidden = true
    this.onAppend?.(div)

    this.transEditorLayer = new PDFTransEditorLayer({
      id: this.id,
      div,
      eventBus: this.eventBus,
      transUIManager: this.transUIManager,
      viewport: clonedViewport,
    })
    this.transEditorLayer.render(clonedViewport)
    this.show()
  }

  removeAllEditorItems() {
    this.transEditorLayer?.removeAllEditorItems()
  }

  cancel() {
    this.cancelled = true
    if (!this.div) {
      return
    }
    this.transEditorLayer?.destroy()
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
