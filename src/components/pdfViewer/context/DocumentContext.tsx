import type { PDFDocumentProxy } from 'pdfjs-dist'
import { createContext, useContext } from 'react'
import { type PDFEventBus } from '../events'
import { LinkService } from '../modules/LinkService'
import { PDFFindController } from '../modules/PDFFindController'
import { PDFRenderingQueue } from '../modules/PDFRenderingQueue'
import { type PDFViewer, type SpreadMode } from '../modules/PDFViewer'
import type { TranslateOption } from '../services/TranslationService'
import { TranslationServiceManager } from '../services/TranslationServiceManager'

interface DocumentContextType {
  file: string
  version: string
  pdfDocument: PDFDocumentProxy | null
  linkService: LinkService
  translationService: TranslationServiceManager
  eventBus: PDFEventBus
  renderingQueue: PDFRenderingQueue
  pdfViewer: PDFViewer | null
  pdfFindController: PDFFindController | null
  spreadMode: SpreadMode
  globalEnableTranslate: boolean
  docFileName: string
  onGlobalModelChange: (model: TranslateOption) => Promise<boolean>
}

export const DocumentContext = createContext<DocumentContextType | null>(null)

export const useDocumentContext = () => {
  const context = useContext(DocumentContext)
  if (!context) {
    throw new Error('useDocumentContext must be used within a DocumentProvider')
  }
  return context
}
