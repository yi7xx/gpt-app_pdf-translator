/* eslint-disable @next/next/no-img-element */
import Skeleton from '@sider/ui/skeleton'
import { cn } from '@sider/utils/tailwindcss'
import { throttle } from 'lodash-es'
import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { CustomScroll } from 'react-custom-scroll'
import { SCROLL_CONTAINER_ID } from '../constants'
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
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [error, setError] = useState(false)

  useEffect(() => {
    const container = document.querySelector(
      `#${SCROLL_CONTAINER_ID} .pdf-thumbnail-list .rcs-inner-container`,
    ) as HTMLDivElement
    containerRef.current = container
  }, [])

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
      className={cn(
        'pdf-thumbnail-list relative size-full overflow-hidden',
        className,
      )}
      style={
        {
          '--thumbnail-loading': '100px',
        } as React.CSSProperties
      }
    >
      <CustomScroll
        className="absolute inset-0 size-full w-[124px]"
        onScroll={handleScroll}
      >
        <div className="box-border flex size-full flex-col gap-[12px] p-[12px]">
          {thumbnails.map((thumbnail) => (
            <div
              key={thumbnail.id}
              data-page-number={thumbnail.id}
              className="pdf-thumbnail-list-item flex w-[100px] flex-col items-center gap-[4px]"
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
                  'border-transparent cursor-pointer overflow-hidden rounded-[8px] border-[1.5px] border-solid transition-all hover:border-color-brand-primary-focus',
                  {
                    '!border-color-brand-primary-normal':
                      currentPage === thumbnail.id,
                  },
                )}
                style={{
                  width: 'var(--thumbnail-width)',
                  height: 'var(--thumbnail-height)',
                }}
              >
                {thumbnail.image && (
                  <img
                    className="object-cover"
                    style={{
                      width: 'var(--thumbnail-width)',
                      height: 'var(--thumbnail-height)',
                    }}
                    src={thumbnail.image}
                    alt={`${thumbnail.id}`}
                  />
                )}
              </div>
              <span
                className={cn(
                  'h-[16px] rounded-[4px] px-[6px] font-normal-11 flex-center',
                  currentPage === thumbnail.id
                    ? 'bg-color-brand-primary-normal text-color-text-secondary-1'
                    : 'bg-color-grey-fill2-normal text-color-text-primary-3',
                )}
              >
                {thumbnail.id}
              </span>
            </div>
          ))}
          {thumbnails.length === 0 && !error && (
            <div className="border-transparent overflow-hidden rounded-[8px] border-[1.5px] border-solid f-i-center">
              <Skeleton width={100} height={128} />
            </div>
          )}
          {error && (
            <div className="border-transparent overflow-hidden rounded-[8px] border-[1.5px] border-solid f-i-center">
              <div className="h-[128px] w-[100px] bg-color-grey-fill2-normal"></div>
            </div>
          )}
        </div>
      </CustomScroll>
    </div>
  )
}

export default memo(ThumbnailList)
