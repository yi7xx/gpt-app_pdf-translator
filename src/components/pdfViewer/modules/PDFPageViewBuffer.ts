import { PDFPageView } from './PDFPageView'
import { PDFTransPageView } from './PDFTransPageView'
import { PDFViewer } from './PDFViewer'

/**
 * PDF 页面视图缓冲区类，用于缓存一定数量的 PDF 页面视图。
 * LRU 缓存
 * see https://github.com/mozilla/pdf.js/blob/2df5d8f3ef65a16ef0eb13668e64d74891b419d0/web/pdf_viewer.js#L133
 */

export type PDFBufferView = PDFPageView | PDFTransPageView

export class PDFPageViewBuffer {
  private buf = new Set<PDFBufferView>()
  private pdfViewer: PDFViewer

  // 缓冲区的最大大小。
  private size = 0

  constructor(size: number, pdfViewer: PDFViewer) {
    this.size = size
    this.pdfViewer = pdfViewer
  }

  /**
   * 将一个 PDFPageView 添加到缓冲区。
   * 如果视图已经存在，将其移到缓冲区末尾（更新使用顺序）。
   * 如果缓冲区超过最大容量，则销毁最早的视图。
   * @param view - 要添加的 PDFPageView 实例。
   */
  push(view: PDFBufferView) {
    const buf = this.buf
    if (buf.has(view)) {
      // 如果视图已存在，则将其移到缓冲区末尾（更新使用顺序）。
      buf.delete(view)
    }
    buf.add(view)

    if (buf.size > this.size) {
      this.destroyFirstView()
    }
  }

  /**
   * 调整缓冲区的大小。
   * 可选参数 `idsToKeep` 用于指定要保留的页面 ID。
   * @param newSize - 新的缓冲区大小。
   * @param idsToKeep - 可选，要延迟销毁的页面 ID 集合。
   */
  resize(newSize: number, idsToKeep: Set<number> = new Set()) {
    this.size = newSize

    const buf = this.buf
    if (idsToKeep) {
      const ii = buf.size
      let i = 1
      for (const view of buf) {
        if (idsToKeep.has(view.id)) {
          buf.delete(view) // 将需要保留的视图移到缓冲区末尾。
          buf.add(view)
        }
        if (++i > ii) {
          break
        }
      }

      // 超过新大小时，销毁最早的视图。
      while (buf.size > this.size) {
        this.destroyFirstView()
      }
    }
  }

  has(view: PDFBufferView) {
    return this.buf.has(view)
  }

  private destroyFirstView() {
    const firstView = this.buf.keys().next().value as PDFBufferView

    this.pdfViewer.destroyView(firstView)
    this.buf.delete(firstView)
  }
}
