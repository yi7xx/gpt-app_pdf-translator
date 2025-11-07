import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { VisibleElements } from '../libs/pdfjs-internal'
import type { AnnotationEditorUIManager } from '../modules/AnnotationEditorUIManager'
import type { PDFRenderingQueueView } from '../modules/PDFRenderingQueue'
import type { PDFViewer, SpreadMode } from '../modules/PDFViewer'
import type { Highlight } from '../modules/highlight'

export type PDFViewerEventMap = {
  [PDFViewerEvent.DocumentInit]: {
    source: PDFDocumentProxy
  }
  [PDFViewerEvent.PagesDestroy]: {
    source: PDFViewer
  }
  [PDFViewerEvent.PagesLoaded]: {
    source: PDFViewer
    pagesCount: number
  }
  [PDFViewerEvent.PagesInit]: {
    source: PDFViewer
  }
  [PDFViewerEvent.PageChanging]: {
    source: PDFViewer
    pageNumber: number
    previous: number
  }
  [PDFViewerEvent.ScaleChanging]: {
    source: PDFViewer
    scale: number
    presetValue?: string | number
  }
  [PDFViewerEvent.UpdateViewArea]: {
    source: PDFViewer
    visible: VisibleElements<PDFRenderingQueueView>
  }
  [PDFViewerEvent.PageResize]: {
    source: any
  }
  [PDFViewerEvent.DocumentLoadError]: {
    source: any
  }
  [PDFViewerEvent.DocumentLoadStart]: void
  [PDFViewerEvent.SpreadModeChanged]: {
    source: PDFViewer
    mode: SpreadMode
  }
  [PDFViewerEvent.EditorAdd]: {
    source: AnnotationEditorUIManager
    editor: Highlight
  }
  [PDFViewerEvent.EditorRemove]: {
    source: AnnotationEditorUIManager
    editor: Highlight
  }
  [PDFViewerEvent.PrintingChanged]: {
    source: PDFViewer
    isPrinting: boolean
  }
  [PDFViewerEvent.ScrollX]: {
    source: PDFViewer
    event: React.UIEvent
  }
  [PDFViewerEvent.ScrollY]: {
    source: PDFViewer
    event: React.UIEvent
  }
}

/**
 * pdf 通用事件
 */
export enum PDFViewerEvent {
  // 开始加载
  DocumentLoadStart = 'pdf:viewer:documentLoadStart',
  // document 初始化完成
  DocumentInit = 'pdf:viewer:documentInit',
  // 页面初始化完成
  PagesInit = 'pdf:viewer:pagesInit',
  // 加载失败
  DocumentLoadError = 'pdf:viewer:documentLoadError',
  // pages页面加载完成 dom
  PagesLoaded = 'pdf:viewer:pagesLoaded',
  // 卸载
  PagesDestroy = 'pdf:viewer:pagesDestroy',
  // 页码发生改变
  PageChanging = 'pdf:viewer:pageChanging',
  // 视图缩放
  ScaleChanging = 'pdf:viewer:scaleChanging',
  // 更新视图区域
  UpdateViewArea = 'pdf:viewer:updateViewArea',
  // 页面尺寸发生变化
  PageResize = 'pdf:viewer:pageResize',
  // 横向滚动
  ScrollX = 'pdf:viewer:scrollX',
  // 纵向滚动
  ScrollY = 'pdf:viewer:scrollY',
  // 扩展模式发生变化
  SpreadModeChanged = 'pdf:viewer:spreadModeChanged',
  // 编辑器添加
  EditorAdd = 'pdf:viewer:editorAdd',
  // 编辑器移除
  EditorRemove = 'pdf:viewer:editorRemove',
  // 打印发生改变
  PrintingChanged = 'pdf:printingChanged',
}
