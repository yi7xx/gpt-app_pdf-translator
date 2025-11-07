import { useSyncSize } from '@sider/hooks'
import { debounce, throttle } from 'lodash-es'
import React, { useCallback, useEffect, useMemo } from 'react'
import { useDocumentContext } from '../context/DocumentContext'
import {
  PDFTransViewerEvents,
  PDFViewerEvent,
  TransServerEvents,
  UIEvents,
} from '../events'
import { ScaleMode } from '../utils/ui'
import { type PDFHooks } from './index'
import { usePDFEvent } from './usePDFEvent'

export const useBindEvent = ({
  containerRef,
  onSpreadModeChanged,
  onTextToHighlight,
  onTriggerTranslateService,
}: PDFHooks) => {
  const { pdfDocument, renderingQueue, eventBus, pdfViewer } =
    useDocumentContext()
  usePDFEvent(PDFViewerEvent.PagesInit, () => {
    renderingQueue?.renderHighestPriority()
  })

  // 选中文本事件
  useEffect(() => {
    const bindPointerUp = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.pdfViewer')) {
        return
      }
      requestAnimationFrame(() => {
        eventBus?.emit(UIEvents.SelectionEnd, {
          event: e,
        })
      })
    }
    window.addEventListener('pointerup', bindPointerUp)
    return () => {
      window.removeEventListener('pointerup', bindPointerUp)
    }
  }, [])

  // 处理pdf页面
  const handlePdfPage = async (
    e: React.PointerEvent,
    pageDom: HTMLDivElement,
  ) => {
    if (!pdfViewer) {
      return
    }
    const pageNumber = +pageDom.dataset.pageNumber!
    const isTranslating =
      await pdfViewer.transUIManager?.isPageTranslating(pageNumber)
    if (isTranslating == null || isTranslating) {
      return
    }
    const transPageView = pdfViewer.getTransPageView(pageNumber)
    const { top, left } = pageDom.getBoundingClientRect()
    const { clientX, clientY } = e
    const x = clientX - left
    const y = clientY - top
    const editorItem = transPageView?.findEditorItem(x, y) || null
    eventBus.emit(PDFTransViewerEvents.PageSpotlight, {
      source: transPageView!,
      from: 'pdf',
      pageNumber,
      editorItem,
      event: e,
    })
  }

  // 处理翻译页面
  const handleTransPage = (e: React.PointerEvent, pageDom: HTMLDivElement) => {
    if (!pdfViewer) {
      return
    }
    const target = e.target as HTMLElement
    const pageNumber = +pageDom.dataset.pageNumber!
    const editorDom = target.classList.contains('pdfTransEditorItemText')
      ? (target.closest('.pdfTransEditorItem') as HTMLElement)
      : target
    const id = editorDom?.dataset.id
    const editorItem = id
      ? (pdfViewer.transUIManager?.getPDFTransEditor(id) ?? null)
      : null
    const transPageView = pdfViewer.getTransPageView(pageNumber)
    eventBus.emit(PDFTransViewerEvents.PageSpotlight, {
      source: transPageView!,
      from: 'pdfTrans',
      pageNumber,
      editorItem: editorItem || null,
      event: e,
    })
  }

  const getPageDom = (target: HTMLElement, className: string) => {
    if (target.classList.contains(className)) {
      return target as HTMLDivElement
    }
    return target.closest(`.${className}`) as HTMLDivElement
  }

  const onPointerMove = useMemo(
    () =>
      throttle((e: React.PointerEvent) => {
        if (!pdfViewer) {
          return
        }
        const target = e.target as HTMLElement
        const pdfPageDom = getPageDom(target, 'pdfPage')
        const transPageDom = getPageDom(target, 'pdfTransPage')
        if (pdfPageDom && pdfPageDom.dataset.pageNumber) {
          handlePdfPage(e, pdfPageDom)
        } else if (transPageDom && transPageDom.dataset.pageNumber) {
          handleTransPage(e, transPageDom)
        }
      }, 30),
    [pdfViewer],
  )

  const onPointerLeave = (e: React.PointerEvent) => {
    if (!pdfViewer) {
      return
    }
    const target = e.target as HTMLElement
    const pdfPageDom = getPageDom(target, 'pdfPage')
    const transPageDom = getPageDom(target, 'pdfTransPage')
    const pageNumber = (pdfPageDom?.dataset.pageNumber ||
      transPageDom?.dataset.pageNumber) as string
    eventBus.emit(PDFTransViewerEvents.PageSpotlight, {
      source: pdfViewer.getTransPageView(+pageNumber) || null,
      from: 'pdfTrans',
      pageNumber: +pageNumber,
      editorItem: null,
      event: e,
    })
  }

  /** ----------------------------------------- 页面缩放 ----------------------------------------- */
  const onResize = useCallback(() => {
    if (!pdfDocument || !pdfViewer) {
      return
    }
    const currentScaleValue = pdfViewer.currentScaleValue
    if (
      ScaleMode.AUTO === currentScaleValue ||
      ScaleMode.PAGE_FIT === currentScaleValue ||
      ScaleMode.PAGE_WIDTH === currentScaleValue
    ) {
      pdfViewer.currentScaleValue = currentScaleValue
    }
    pdfViewer.update()
  }, [pdfDocument, pdfViewer])

  const onResizeDebounce = useMemo(() => debounce(onResize, 100), [onResize])

  usePDFEvent(PDFViewerEvent.PageResize, () => {
    onResizeDebounce()
  })

  useSyncSize(containerRef, onResizeDebounce)

  usePDFEvent(PDFViewerEvent.SpreadModeChanged, ({ source }) => {
    onSpreadModeChanged?.(source.spreadMode)
  })

  usePDFEvent(UIEvents.TextToHighlightSuccess, ({ source, highlight }) => {
    onTextToHighlight?.({ source, highlight })
  })

  usePDFEvent(TransServerEvents.TRIGGER_TRANSLATE_SERVICE, (params) => {
    onTriggerTranslateService?.(params)
  })

  return { onPointerMove, onPointerLeave }
}
