import type { PDFPageView } from '../modules/PDFPageView'

export type PDFPageEventMap = {
  [PDFPageEvent.PageRender]: {
    source: PDFPageView
    pageNumber: number
  }
  [PDFPageEvent.PageRendered]: {
    source: PDFPageView
    pageNumber: number
    // 是否为 CSS Transform 渲染
    cssTransform: boolean
    timestamp: number
    error: Error | null
  }
  [PDFPageEvent.TextLayerRendered]: {
    source: PDFPageView
    pageNumber: number
    error: Error | null
  }
  [PDFPageEvent.AnnotationLayerRendered]: {
    source: PDFPageView
    pageNumber: number
    error: Error | null
  }
  [PDFPageEvent.AnnotationEditorLayerRendered]: {
    source: PDFPageView
    pageNumber: number
    error: Error | null
  }
  [PDFPageEvent.PageDestroy]: {
    source: PDFPageView
    pageNumber: number
  }
}

export enum PDFPageEvent {
  // 任意页面渲染开始时
  PageRender = 'pdf:page:render',
  // 任意页面渲染完成时
  PageRendered = 'pdf:page:pageRendered',
  // 文本层渲染完成时
  TextLayerRendered = 'pdf:page:textLayerRendered',
  // 注释层渲染完成时
  AnnotationLayerRendered = 'pdf:page:annotationLayerRendered',
  // 注释编辑层渲染完成时
  AnnotationEditorLayerRendered = 'pdf:page:annotationEditorLayerRendered',
  // 页面销毁时
  PageDestroy = 'pdf:page:pageDestroy',
}
