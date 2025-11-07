import { throttle } from 'lodash-es'
import { useMemo, useRef } from 'react'
import { useDocumentContext } from '../context/DocumentContext'
import { PDFViewerEvent } from '../events/pdfViewer'
import { type PDFHooks } from './index'

export const useWatchScroll = (hooks: PDFHooks) => {
  const { pdfViewer, eventBus } = useDocumentContext()
  const currentScrollTop = useRef(0)
  const onScrollY = useMemo(
    () =>
      throttle((e: React.UIEvent) => {
        requestAnimationFrame(() => {
          const target = e.target as HTMLElement
          const scrollTop = target.scrollTop
          const prevScrollTop = currentScrollTop.current
          // 是否为向下滚动
          const isScrollingDown = scrollTop > prevScrollTop
          currentScrollTop.current = scrollTop
          pdfViewer?.setScrollDown(isScrollingDown)
          pdfViewer?.update()
          eventBus.emit(PDFViewerEvent.ScrollY, {
            event: e,
            source: pdfViewer!,
          })
        })
      }, 50),
    [pdfViewer],
  )

  const onScrollX = useMemo(
    () =>
      throttle((e: React.UIEvent) => {
        requestAnimationFrame(() => {
          eventBus.emit(PDFViewerEvent.ScrollX, {
            event: e,
            source: pdfViewer!,
          })
        })
      }, 50),
    [eventBus, pdfViewer],
  )

  return { onScrollY, onScrollX }
}
