import type { PDFTransEditorItem } from '../modules/PDFTransEditorItem'
import type { PDFTransPageView } from '../modules/PDFTransPageView'
import type {
  PDFTransViewerUIManager,
  TranslationState,
} from '../modules/PDFTransViewerUIManager'

export type PDFTransViewerEventsMap = {
  [PDFTransViewerEvents.PageRendered]: {
    source: PDFTransPageView
    pageNumber: number
    cssTransform: boolean
    timestamp: number
    error: Error | null
  }
  [PDFTransViewerEvents.PageRender]: {
    source: PDFTransPageView
    pageNumber: number
  }
  [PDFTransViewerEvents.ExtractTextsDone]: {
    source: PDFTransViewerUIManager
    timestamp: number
  }
  [PDFTransViewerEvents.TranslationStateUpdated]: {
    source: PDFTransViewerUIManager
    pageNumber: number
    state: TranslationState
  }
  [PDFTransViewerEvents.PageSpotlight]: {
    source: PDFTransPageView | null
    // 事件来源
    from: 'pdf' | 'pdfTrans'
    pageNumber: number
    editorItem: PDFTransEditorItem | null
    event: React.PointerEvent
  }
  [PDFTransViewerEvents.TranslatePageRequestAdded]: {
    source: PDFTransViewerUIManager
    pageNumber: number
    id: string
  }
  [PDFTransViewerEvents.TranslatePageRequestRemoved]: {
    source: PDFTransViewerUIManager
    pageNumber: number
    id: string
  }
  [PDFTransViewerEvents.PageDestroy]: {
    source: PDFTransPageView
    pageNumber: number
  }
}

/**
 * 侧边栏通用事件
 */
export enum PDFTransViewerEvents {
  // 翻译服务提取文本完成
  ExtractTextsDone = 'pdfTransViewer:extractTextsDone',
  // 翻译状态更新
  TranslationStateUpdated = 'pdfTransViewer:translationStateUpdated',
  // 页面翻译选中
  PageSpotlight = 'pdfTransViewer:pageSpotlight',
  // 页面翻译请求添加
  TranslatePageRequestAdded = 'pdfTransViewer:translatePageRequestAdded',
  // 页面翻译请求移除
  TranslatePageRequestRemoved = 'pdfTransViewer:translatePageRequestRemoved',
  // 页面渲染开始时
  PageRender = 'pdfTransViewer:pageRender',
  // 任意页面渲染完成时
  PageRendered = 'pdfTransViewer:pageRendered',
  // 页面销毁时
  PageDestroy = 'pdfTransViewer:pageDestroy',
}
