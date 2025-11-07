import {
  AnnotationLayer,
  type PageViewport,
  type PDFPageProxy,
} from 'pdfjs-dist'
import { type AnnotationLayerParameters } from 'pdfjs-dist/types/src/display/annotation_layer'
import { type AnnotationStorage } from 'pdfjs-dist/types/src/display/annotation_storage'
import { type IDownloadManager } from 'pdfjs-dist/types/web/interfaces'
import { AnnotationEditorUIManager } from './AnnotationEditorUIManager'
import { LinkService } from './LinkService'

interface AnnotationLayerProps {
  pdfPage: PDFPageProxy
  linkService: LinkService
  annotationEditorUIManager: AnnotationEditorUIManager
  imageResourcesPath?: string
  downloadManager?: IDownloadManager
  annotationStorage?: AnnotationStorage
  onAppend: (div: HTMLDivElement) => void
}

export class AnnotationLayerBuilder {
  public div: HTMLDivElement | null
  public imageResourcesPath: string

  private pdfPage: PDFPageProxy
  private onAppend: (div: HTMLDivElement) => void | null
  private canceled: boolean
  private annotationLayer: AnnotationLayer | null
  private linkService: LinkService
  private downloadManager?: IDownloadManager
  private annotationStorage?: AnnotationStorage
  private annotationEditorUIManager: AnnotationEditorUIManager

  constructor(options: AnnotationLayerProps) {
    this.pdfPage = options.pdfPage
    this.onAppend = options.onAppend || null
    this.imageResourcesPath = options.imageResourcesPath || ''
    this.canceled = false
    this.downloadManager = options.downloadManager
    this.annotationStorage = options.annotationStorage
    this.div = null
    this.annotationLayer = null
    this.linkService = options.linkService
    this.annotationEditorUIManager = options.annotationEditorUIManager
  }

  async render(
    viewport: PageViewport,
    options?: { structTreeLayer: any },
    intent: string = 'display',
  ) {
    if (this.div) {
      if (this.canceled || !this.annotationLayer) {
        return
      }
      this.annotationLayer.update({
        viewport: viewport.clone({ dontFlip: true }),
      } as AnnotationLayerParameters)
      return
    }

    const annotations = await this.pdfPage.getAnnotations({ intent })

    if (this.canceled) {
      return
    }

    const div = (this.div = document.createElement('div'))
    div.className = 'annotationLayer'
    this.onAppend?.(div)

    if (annotations.length === 0) {
      this.hide()
      return
    }
    this.annotationLayer = new AnnotationLayer({
      div,
      accessibilityManager: null,
      annotationCanvasMap: null,
      annotationEditorUIManager: null,
      page: this.pdfPage,
      viewport: viewport.clone({ dontFlip: true }),
      structTreeLayer: options?.structTreeLayer || null,
    })

    await this.annotationLayer.render({
      div,
      annotations,
      page: this.pdfPage,
      imageResourcesPath: this.imageResourcesPath,
      renderForms: false,
      linkService: this.linkService,
      downloadManager: this.downloadManager,
      annotationStorage: this.annotationStorage,
      hasJSActions: false,
      viewport: viewport.clone({ dontFlip: true }),
    })
  }

  cancel() {
    this.canceled = true
  }

  hide() {
    if (!this.div) {
      return
    }
    this.div.hidden = true
  }
}
