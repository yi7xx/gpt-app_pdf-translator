import type { PDFPageProxy } from 'pdfjs-dist'
import type { PDFThumbnailView } from '../modules/PDFThumbnailView'
import type { PDFThumbnailViewer } from '../modules/PDFThumbnailViewer'

export type PDFThumbnailEventMap = {
  [PDFThumbnailEvent.ThumbnailsInit]: {
    source: PDFThumbnailViewer
  }
  [PDFThumbnailEvent.ThumbnailsDestroy]: {
    source: PDFThumbnailViewer
  }
  [PDFThumbnailEvent.ThumbnailRendered]: {
    source: PDFThumbnailView
    pageNumber: number
    pdfPage: PDFPageProxy
    timestamp: number
  }
  [PDFThumbnailEvent.ThumbnailUpdate]: {
    source: PDFThumbnailView
    src: string | null
    pageNumber: number
    pdfPage: PDFPageProxy
  }
}

/**
 * thumbnail 通用事件
 */
export enum PDFThumbnailEvent {
  // 缩略图初始化
  ThumbnailsInit = 'pdf:thumbnail:init',
  // 卸载
  ThumbnailsDestroy = 'pdf:thumbnail:destroy',
  // 缩略图渲染完成
  ThumbnailRendered = 'pdf:thumbnail:rendered',
  // 更新预览图地址
  ThumbnailUpdate = 'pdf:thumbnail:update',
}
