import { RenderingCancelledException } from 'pdfjs-dist'
import { type VisibleElements } from '../libs/pdfjs-internal'
import { RenderingStates } from '../utils/ui'
import { PDFThumbnailViewer } from './PDFThumbnailViewer'
import { PDFViewer } from './PDFViewer'

export interface PDFRenderingQueueView {
  id: number
  div: HTMLElement
  renderingState: RenderingStates
  renderingId: string
  resume: (() => void) | null
  draw: () => Promise<void>
}

/**
 * 渲染队列
 * 管理 PDF 页面的渲染任务
 * see https://github.com/mozilla/pdf.js/blob/master/web/pdf_rendering_queue.js
 */
export class PDFRenderingQueue {
  pdfViewer: PDFViewer | null
  highestPriorityPage: string | null
  pdfThumbnailViewer: PDFThumbnailViewer | null
  isThumbnailViewEnabled: boolean

  constructor() {
    this.pdfViewer = null
    this.highestPriorityPage = null
    this.pdfThumbnailViewer = null
    this.isThumbnailViewEnabled = false
  }

  setViewer(pdfViewer: PDFViewer) {
    this.pdfViewer = pdfViewer
  }

  setThumbnailViewer(pdfThumbnailViewer: PDFThumbnailViewer) {
    this.pdfThumbnailViewer = pdfThumbnailViewer
  }

  /**
   * 判断当前页面是否是最高优先级页面
   */
  isHighestPriority<T extends PDFRenderingQueueView>(view: T) {
    return this.highestPriorityPage === view.renderingId
  }

  /**
   * 渲染当前最高优先级的页面
   */
  renderHighestPriority<T extends PDFRenderingQueueView>(
    currentlyVisiblePages?: VisibleElements<T>,
  ) {
    if (!this.pdfViewer) return
    // pages 的优先级高于 thumbnail
    if (this.pdfViewer.forceRendering(currentlyVisiblePages as any)) {
      return
    }
    if (this.isThumbnailViewEnabled) {
      this.pdfThumbnailViewer?.forceRendering()
    }
  }

  /**
   * 获取需要渲染的最高优先级页面
   */
  getHighestPriority<T extends PDFRenderingQueueView>(
    visible: VisibleElements<T>,
    views: T[],
    scrolledDown: boolean,
    preRenderExtra = false,
  ): T | null {
    // 当前可见的页面视图
    const visibleViews = visible.views,
      numVisible = visibleViews.length

    // 如果没有可见页面，返回 null
    if (numVisible === 0) {
      return null
    }

    // 优先渲染当前可见的页面
    for (let i = 0; i < numVisible; i++) {
      const view = visibleViews[i]!.view!
      if (!this.isViewFinished(view)) {
        return view
      }
    }

    // 如果所有可见页面已渲染，尝试处理布局中的空白区域
    const firstId = visible.first!.id,
      lastId = visible.last!.id

    if (lastId - firstId + 1 > numVisible) {
      const visibleIds = visible.ids
      for (let i = 1, ii = lastId - firstId; i < ii; i++) {
        const holeId = scrolledDown ? firstId + i : lastId - i
        if (visibleIds.has(holeId)) {
          continue
        }
        const holeView = views[holeId - 1]
        if (!this.isViewFinished(holeView!)) {
          return holeView as T
        }
      }
    }

    // 如果没有空白区域，尝试渲染前一页或后一页
    let preRenderIndex = scrolledDown ? lastId : firstId - 2
    let preRenderView = views[preRenderIndex]

    if (preRenderView && !this.isViewFinished(preRenderView)) {
      return preRenderView
    }
    if (preRenderExtra) {
      preRenderIndex += scrolledDown ? 1 : -1
      preRenderView = views[preRenderIndex]

      if (preRenderView && !this.isViewFinished(preRenderView)) {
        return preRenderView
      }
    }
    return null
  }

  /**
   * 判断页面是否已完成渲染
   * @param view PDFPageView 实例
   * @returns 页面是否已完成渲染
   */
  isViewFinished<T extends { renderingState: RenderingStates }>(view: T) {
    return view.renderingState === RenderingStates.FINISHED
  }

  /**
   * 渲染指定页面
   * @param view PDFPageView 实例
   * @returns 是否启动渲染
   */
  renderView<T extends PDFRenderingQueueView>(view: T) {
    switch (view.renderingState) {
      case RenderingStates.FINISHED:
        return false
      case RenderingStates.PAUSED:
        // 设置当前最高优先级页面并恢复渲染
        this.highestPriorityPage = view.renderingId
        view.resume?.()
        break

      case RenderingStates.RUNNING:
        this.highestPriorityPage = view.renderingId
        break
      case RenderingStates.INITIAL:
        this.highestPriorityPage = view.renderingId
        view
          .draw()
          .finally(() => {
            this.renderHighestPriority()
          })
          .catch((reason) => {
            if (reason instanceof RenderingCancelledException) {
              return
            }
            console.error(`renderView: `, reason)
          })
        break
    }
    return true
  }
}
