import { type RefObject } from 'react'
import type { TextToHighlight } from '../modules/AnnotationEditorUIManager'
import { type SpreadMode } from '../modules/PDFViewer'
import type { Highlight } from '../modules/highlight'
import type { TranslateServiceInfo } from '../services/TranslationServiceManager'

export interface PDFHooks {
  containerRef: RefObject<HTMLDivElement | null>
  pdfViewerRef: RefObject<HTMLDivElement | null>
  onSpreadModeChanged?: (spreadMode: SpreadMode) => void
  onTextToHighlight?: (payload: {
    source: TextToHighlight
    highlight: Highlight
  }) => void
  onTriggerTranslateService?: (params: TranslateServiceInfo) => void
}
