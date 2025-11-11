import type { Mitter } from '@/utils/mitter'
import type { FindEventMap } from './find'
import type { PDFPageEventMap } from './pdfPageViewer'
import type { PDFThumbnailEventMap } from './pdfThumbnail'
import type { PDFTransViewerEventsMap } from './pdfTransViewer'
import type { PDFViewerEventMap } from './pdfViewer'
import type { TransServerEventsMap } from './transServer'
import type { UIEventsMap } from './ui'
export type PDFEventMap = PDFViewerEventMap &
  PDFPageEventMap &
  PDFThumbnailEventMap &
  UIEventsMap &
  FindEventMap &
  PDFTransViewerEventsMap &
  TransServerEventsMap

export type PDFEventBus = Mitter<PDFEventMap>

export * from './find'
export * from './pdfPageViewer'
export * from './pdfThumbnail'
export * from './pdfTransViewer'
export * from './pdfViewer'
export * from './transServer'
export * from './ui'
