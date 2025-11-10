/* eslint-disable @next/next/no-img-element */
import Skeleton from '@/components/Skeleton'
import { cn } from '@/utils/cn'
import { throttle } from 'lodash-es'
import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useDocumentContext } from '../context/DocumentContext'
import { PDFPageEvent, PDFViewerEvent } from '../events'
import { PDFThumbnailEvent } from '../events/pdfThumbnail'
import { usePDFEvent } from '../hooks/usePDFEvent'
import { PDFThumbnailView } from '../modules/PDFThumbnailView'
import { PDFThumbnailViewer } from '../modules/PDFThumbnailViewer'

interface ThumbnailListProps {
  className?: string
}

const ThumbnailList = ({ className }: ThumbnailListProps) => {
  const { linkService, eventBus, renderingQueue, pdfViewer } =
    useDocumentContext()
  const [thumbnails, setThumbnails] = useState<PDFThumbnailView[]>([])
  const [pdfThumbnailViewer, setPdfThumbnailViewer] =
    useState<PDFThumbnailViewer | null>(null)
  const [isPending, startTransition] = useTransition()

  const [currentPage, setCurrentPage] = useState<number>(1)
  const containerRef = useRef<HTMLDivElement>(null)

  const [error, setError] = useState(false)

  usePDFEvent(PDFViewerEvent.DocumentLoadStart, () => {
    setError(false)
  })

  usePDFEvent(PDFViewerEvent.DocumentLoadError, () => {
    setError(true)
  })

  // 更新图片地址
  usePDFEvent(PDFThumbnailEvent.ThumbnailUpdate, () => {
    startTransition(() => {
      setThumbnails((thumbnails) => [...thumbnails])
    })
  })

  // 初始化
  useEffect(() => {
    const pdfThumbnailViewer = new PDFThumbnailViewer({
      container: containerRef.current!,
      eventBus,
      linkService,
      renderingQueue,
    })
    setPdfThumbnailViewer(pdfThumbnailViewer)
  }, [eventBus, linkService, renderingQueue])

  usePDFEvent(PDFViewerEvent.DocumentInit, ({ source }) => {
    pdfThumbnailViewer?.setDocument(source)
  })

  usePDFEvent(PDFThumbnailEvent.ThumbnailsInit, ({ source }) => {
    setThumbnails([...source.thumbnails])
  })

  usePDFEvent(PDFViewerEvent.PageChanging, ({ pageNumber, source }) => {
    if (pageNumber === currentPage) return
    setCurrentPage(pageNumber)
    pdfThumbnailViewer?.scrollThumbnailIntoView(pageNumber)
  })

  usePDFEvent(PDFPageEvent.PageRendered, ({ source, pageNumber }) => {
    const pageView = pdfViewer?.getPageView(pageNumber)
    if (!pageView) return
    const thumbnail = pdfThumbnailViewer?.getThumbnail(pageNumber)
    thumbnail?.setImage(pageView)
  })

  // 销毁时清空
  usePDFEvent(PDFViewerEvent.PagesDestroy, () => {
    setCurrentPage(1)
    setThumbnails([])
    pdfThumbnailViewer?.setDocument(null)
  })

  const handleScroll = useMemo(() => {
    return throttle(() => {
      if (!pdfThumbnailViewer) return
      pdfThumbnailViewer.scrollUpdated()
    }, 100)
  }, [pdfThumbnailViewer])

  return (
    <div
      ref={containerRef}
      className={cn(
        'custom-scrollbar custom-scrollbar-float custom-scrollbar-hidden pdf-thumbnail-list relative size-full space-y-3 overflow-x-hidden overflow-y-auto p-3 pr-1.5',
        className,
      )}
      onScroll={handleScroll}
      style={
        {
          '--thumbnail-loading': '100px',
          '--scrollbar-margin-block': '12px',
          scrollbarGutter: 'stable',
        } as React.CSSProperties
      }
    >
      {thumbnails.map((thumbnail) => (
        <div
          key={thumbnail.id}
          data-page-number={thumbnail.id}
          className="pdf-thumbnail-list-item flex w-25 flex-col items-center gap-1"
          style={
            {
              '--thumbnail-width': '100px',
              '--thumbnail-height': '128px',
            } as React.CSSProperties
          }
          ref={(ref) => {
            if (!ref) return
            thumbnail.setDiv(ref)
          }}
          onClick={() => thumbnail.goToPage()}
        >
          <div
            className={cn(
              'box-content cursor-pointer overflow-hidden rounded-2xl outline-1 outline-transparent transition-all',
              currentPage === thumbnail.id
                ? 'outline-interactive-focus'
                : 'hover:outline-border-light',
            )}
            style={{
              width: 'var(--thumbnail-width)',
              height: 'var(--thumbnail-height)',
            }}
          >
            {thumbnail.image && (
              <img
                className="size-full object-cover"
                src={thumbnail.image}
                alt={`${thumbnail.id}`}
              />
            )}
          </div>
          <span
            className={cn(
              'font-semibold-12 flex-center h-[18px] min-w-6 rounded-md px-1',
              currentPage === thumbnail.id
                ? 'bg-interactive-bg-primary-default text-text-inverted'
                : 'bg-interactive-bg-secondary-hover text-text-secondary',
            )}
          >
            {thumbnail.id}
          </span>
        </div>
      ))}
      {thumbnails.length === 0 && !error && (
        <div className="f-i-center overflow-hidden rounded-2xl outline-1 outline-transparent">
          <Skeleton width={100} height={128} />
        </div>
      )}
      {error && (
        <div className="f-i-center overflow-hidden rounded-2xl outline-1 outline-transparent">
          <div className="bg-grey-fill2-normal h-[128px] w-[100px]"></div>
        </div>
      )}
    </div>
  )
}

export default memo(ThumbnailList)
