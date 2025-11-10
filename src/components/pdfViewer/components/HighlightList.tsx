import useI18n from '@/hooks/useI18n'
import { cn } from '@/utils/cn'
import { Typography } from 'antd'
import { Fragment, useCallback, useRef, useState } from 'react'
import { useDocumentContext } from '../context/DocumentContext'
import { PDFViewerEvent } from '../events'
import { UIEvents } from '../events/ui'
import { usePDFEvent } from '../hooks/usePDFEvent'
import { type Boxes } from '../modules/highlight'

export interface HighlightItem {
  id: string
  text: string
  // 返回的临时位置，取起始位
  pageNumber: number
  matchPageNumbers: number[]
  boxes?: Boxes
  color?: string
  hoverColor?: string
}

interface HighlightListProps {
  className?: string
}

const useUpdate = () => {
  const [_, setUpdate] = useState({})
  const update = useCallback(() => {
    setUpdate({})
  }, [])
  return update
}

export const HighlightList = ({ className }: HighlightListProps) => {
  const { t } = useI18n()
  const { pdfViewer } = useDocumentContext()
  // pageNumber -> highlights
  const highlightsMapRef = useRef<Record<number, HighlightItem[]>>({})
  const update = useUpdate()

  const sortHighlights = (
    highlights: HighlightItem[],
    highlight: HighlightItem,
  ) => {
    const boxes = highlight.boxes
    if (!boxes?.[0]) {
      return [...highlights, highlight]
    }
    const index = highlights.findIndex((h) => {
      const box = h.boxes?.[0]
      if (!box) {
        return true
      }
      return box.y > boxes[0]!.y
    })
    if (index === -1) {
      return [...highlights, highlight]
    }
    highlights.splice(index, 0, highlight)
    return highlights
  }

  usePDFEvent(UIEvents.AddHighlight, ({ source, highlight }) => {
    const pageNumber = highlight.pageNumber
    const highlights = highlightsMapRef.current[pageNumber] || []
    const newHighlights = sortHighlights(highlights, highlight)
    highlightsMapRef.current[pageNumber] = newHighlights
    update()
  })

  usePDFEvent(UIEvents.RemoveHighlight, ({ source, highlight }) => {
    const pageNumber = highlight.pageNumber
    const highlights = highlightsMapRef.current[pageNumber] || []
    const newHighlights = highlights.filter((h) => h.id !== highlight.id)
    highlightsMapRef.current[pageNumber] = newHighlights
    update()
  })

  usePDFEvent(PDFViewerEvent.PagesDestroy, () => {
    highlightsMapRef.current = {}
    update()
  })

  const handleClick = (highlight: HighlightItem) => {
    if (!pdfViewer?.uiManager) return
    pdfViewer.uiManager.scrollHighlightIntoView(highlight)
  }

  const highlightsMap = highlightsMapRef.current

  return (
    <div
      className={cn(
        'pdf-thumbnail-list relative size-full overflow-hidden',
        className,
      )}
    >
      <div className="custom-scrollbar absolute inset-0 w-[204px] overflow-y-auto">
        <div className="box-border flex size-full flex-col gap-[12px] p-[12px]">
          {Object.entries(highlightsMap).map(([pageNumber, highlights]) => (
            <Fragment key={pageNumber}>
              {highlights.map((highlight) => (
                <div
                  key={highlight.id}
                  onClick={() => handleClick(highlight)}
                  className={cn(
                    'hover:bg-grey-fill1-hover box-border flex cursor-pointer rounded-[8px] p-[8px] transition-colors',
                  )}
                >
                  <Typography.Paragraph
                    className="text-text-primary-1 font-normal-12 !mb-0 box-border rounded-[2px] border-l-[2px] py-[2px] pl-[6px]"
                    style={{
                      borderColor: highlight.color,
                    }}
                    ellipsis={{
                      rows: 2,
                      tooltip: {
                        align: {
                          offset: [36, -6],
                        },
                      },
                    }}
                  >
                    {highlight.text}
                  </Typography.Paragraph>
                </div>
              ))}
            </Fragment>
          ))}
          {Object.values(highlightsMap).length === 0 && (
            <div className="py1.5 text-text-primary-4 font-normal-14 px-2">
              {t('pdfViewer.tools.highlight-empty')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
