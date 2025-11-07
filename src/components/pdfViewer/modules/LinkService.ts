import { type PDFDocumentProxy } from 'pdfjs-dist'
import { IPDFLinkService } from 'pdfjs-dist/types/web/interfaces'
import { type PDFEventBus } from '../events'
import { TranslationServiceManager } from '../services/TranslationServiceManager'
import { PDFViewer } from './PDFViewer'

interface LinkServiceOptions {
  eventBus: PDFEventBus
  translationService: TranslationServiceManager
  externalLinkTarget?: ExternalLinkTarget | null
  externalLinkRel?: ExternalLinkRel | null
  ignoreDestinationZoom?: boolean
}

const DEFAULT_LINK_REL = 'noopener noreferrer nofollow'

export type ExternalLinkRel = string

export type ExternalLinkTarget = '_self' | '_blank' | '_parent' | '_top'

export class LinkService implements IPDFLinkService {
  externalLinkEnabled: boolean
  pdfDocument: PDFDocumentProxy | null = null
  pdfViewer: PDFViewer | null = null
  eventBus: PDFEventBus
  translationService: TranslationServiceManager

  externalLinkTarget: ExternalLinkTarget | null = null
  externalLinkRel: ExternalLinkRel | null = null
  ignoreDestinationZoom: boolean = false
  isInPresentationMode: boolean = false

  constructor({
    eventBus,
    translationService,
    externalLinkTarget = null,
    externalLinkRel = null,
    ignoreDestinationZoom = false,
  }: LinkServiceOptions) {
    this.eventBus = eventBus
    this.externalLinkEnabled = true
    this.externalLinkTarget = externalLinkTarget
    this.externalLinkRel = externalLinkRel
    this.ignoreDestinationZoom = ignoreDestinationZoom
    this.translationService = translationService
    this.pdfViewer = null
  }

  get pagesCount(): number {
    return this.pdfDocument ? this.pdfDocument.numPages : 0
  }
  set page(value: number) {
    if (!this.pdfDocument || !this.pdfViewer) return
    this.pdfViewer.currentPageNumber = value
  }
  get page(): number {
    return this.pdfViewer?.currentPageNumber || 0
  }

  setDocument(pdfDocument: PDFDocumentProxy | null) {
    this.pdfDocument = pdfDocument
  }

  setViewer(pdfViewer: PDFViewer) {
    this.pdfViewer = pdfViewer
  }

  getPageView(pageNumber: number) {
    return this.pdfViewer?.getPageView(pageNumber) || null
  }

  set rotation(value: number) {}
  get rotation(): number {
    return 0
  }

  setHash(): void {}

  async goToDestination(dest: string | any[]): Promise<void> {
    if (!this.pdfDocument) {
      return
    }

    let namedDest
    let explicitDest
    let pageNumber

    if (typeof dest === 'string') {
      namedDest = dest
      explicitDest = await this.pdfDocument.getDestination(dest)
    } else {
      namedDest = null
      explicitDest = await dest
    }
    if (!Array.isArray(explicitDest)) {
      console.error(
        `goToDestination: "${explicitDest}" is not a valid destination array, for dest="${dest}".`,
      )
      return
    }
    const [destRef] = explicitDest
    if (destRef && typeof destRef === 'object') {
      pageNumber = this.pdfDocument.cachedPageNumber(destRef.pageNumber)
      if (!pageNumber) {
        try {
          pageNumber = (await this.pdfDocument.getPageIndex(destRef)) + 1
        } catch {
          console.error(
            `goToDestination: "${destRef}" is not a valid page reference, for dest="${dest}".`,
          )
          return
        }
      }
    } else if (Number.isInteger(destRef)) {
      pageNumber = destRef + 1
    }

    if (!pageNumber || pageNumber < 1 || pageNumber > this.pagesCount) {
      console.error(
        `goToDestination: "${pageNumber}" is not a valid page number, for dest="${dest}".`,
      )
      return
    }
    this.pdfViewer?.scrollPageIntoView({ pageNumber })
  }
  goToPage(val: number | string, top?: number) {
    if (!this.pdfDocument) {
      return false
    }
    const pageNumber = typeof val === 'number' ? val : parseInt(val) | 0
    if (
      !(
        Number.isInteger(pageNumber) &&
        pageNumber > 0 &&
        pageNumber <= this.pagesCount
      )
    ) {
      console.error(
        `PDFLinkService#goToPage: pageNumber is invalid, pageNumber: ${pageNumber}, pagesCount: ${this.pagesCount}`,
      )
      return false
    }
    this.pdfViewer?.scrollPageIntoView({ pageNumber, top })
    return true
  }
  addLinkAttributes(
    link: HTMLAnchorElement,
    url: string,
    newWindow?: boolean,
  ): void {
    link.href = url
    link.rel = this.externalLinkRel || DEFAULT_LINK_REL
    link.target = newWindow ? '_blank' : this.externalLinkTarget || ''
  }
  getDestinationHash(dest: any): string {
    return '#'
  }
  getAnchorUrl(hash: any): string {
    return '#'
  }
  executeNamedAction(action: string): void {
    console.log('executeNamedAction', action)
  }
  executeSetOCGState(action: object): void {
    console.log('executeSetOCGState', action)
  }
}
