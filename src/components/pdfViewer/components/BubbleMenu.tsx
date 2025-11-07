'use client'

import { cn } from '@/utils/cn'
import { useMemoizedFn } from 'ahooks'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type FC } from 'react'
import ReactDOM from 'react-dom'
import { useDocumentContext } from '../context/DocumentContext'
import { PDFViewerEvent, UIEvents } from '../events'
import { usePDFEvent } from '../hooks/usePDFEvent'
import { Highlight } from '../modules/highlight'

interface ChildrenProps {
  resetBubbleMenu: () => void
  isHighlight: boolean
  // 是否启用翻译
  enableTranslate: boolean
  currentHighlight: Highlight | null
}

interface BubbleMenuProps {
  className?: string
  container?: (() => HTMLElement) | HTMLElement | null
  children: (props: ChildrenProps) => React.ReactNode
  onHighlight?: (highlight: Highlight | null) => void
}

// 偏移
const BUBBLE_MENU_OFFSET = 0

const BubbleMenuComponent: FC<BubbleMenuProps> = ({
  children,
  className,
  onHighlight,
}) => {
  const { translationService } = useDocumentContext()
  const bubbleMenuRef = useRef<HTMLDivElement>(null)
  const [isHighlight, setIsHighlight] = useState<boolean>(false)
  const [currentHighlight, setCurrentHighlight] = useState<Highlight | null>(
    null,
  )
  const [enableTranslate, setEnableTranslate] = useState<boolean>(
    translationService.enableTranslateService,
  )

  usePDFEvent(PDFViewerEvent.SpreadModeChanged, () => {
    setEnableTranslate(translationService.enableTranslateService)
  })

  const resetBubbleMenu = useMemoizedFn(() => {
    const bubbleMenu = bubbleMenuRef.current
    if (!bubbleMenu) return
    bubbleMenu.style.visibility = 'hidden'
    bubbleMenu.style.zIndex = '-1'
    onHighlight?.(null)
  })

  const updateBubbleMenuPosition = (position: {
    rect: DOMRect
    pageX: number
    pageY: number
    isHighlight: boolean
  }) => {
    const bubbleMenu = bubbleMenuRef.current
    const firstChild = bubbleMenu?.firstChild as HTMLDivElement
    if (!bubbleMenu || !firstChild) return

    setIsHighlight(position.isHighlight ?? false)

    bubbleMenu.style.visibility = 'visible'
    bubbleMenu.style.zIndex = '1000'
    bubbleMenu.classList.remove('animate-fade-in')

    const { offsetWidth, offsetHeight } = firstChild
    const { rect, pageX, pageY } = position
    const middleY = rect.top + rect.height / 2
    const placement = pageY > middleY ? 'bottom' : 'top'

    let translateX = 0
    let translateY = 0

    if (placement === 'top') {
      translateY = rect.top - offsetHeight - BUBBLE_MENU_OFFSET
    } else if (placement === 'bottom') {
      translateY = rect.bottom + BUBBLE_MENU_OFFSET
    }
    translateX = pageX - offsetWidth / 2

    // 如果超出屏幕，则调整位置
    if (translateX < 0) {
      translateX = BUBBLE_MENU_OFFSET
    } else if (translateX + offsetWidth > window.innerWidth) {
      translateX = window.innerWidth - offsetWidth - BUBBLE_MENU_OFFSET
    }

    if (translateY < 0) {
      translateY = BUBBLE_MENU_OFFSET
    } else if (translateY + offsetHeight > window.innerHeight) {
      translateY = window.innerHeight - offsetHeight - BUBBLE_MENU_OFFSET
    }

    bubbleMenu.style.transform = `translate(${translateX}px, ${translateY}px)`
    bubbleMenu.classList.add('animate-fade-in')
  }

  usePDFEvent(UIEvents.ToggleHighlight, ({ source, selected, event }) => {
    if (!selected) {
      resetBubbleMenu()
      return
    }
    const rect = source.rect
    if (!rect) {
      return
    }
    setCurrentHighlight(source)
    onHighlight?.(source)
    const { pageX, pageY } = event
    updateBubbleMenuPosition({ rect, pageX, pageY, isHighlight: true })
  })

  usePDFEvent(UIEvents.SelectionEnd, ({ event }) => {
    const bubbleMenu = bubbleMenuRef.current
    if (!bubbleMenu) return
    const selection = window.getSelection()
    const selectedText = selection?.toString().trim()
    if (!selection || selection.isCollapsed || !selectedText) {
      resetBubbleMenu()
      return
    }
    const { pageX, pageY } = event
    const range = selection.getRangeAt(0)

    const parent = range.commonAncestorContainer as HTMLElement

    if (parent.nodeType !== Node.TEXT_NODE) {
      if (parent.classList.contains('pdfViewer')) {
        resetBubbleMenu()
        return
      }
      if (parent.classList.contains('pdfPage')) {
        // 如果选中的文本在pdf页面上，则需要处理selection
        const textLayer = parent.querySelector('.textLayer')
        const lastTextNode = textLayer?.lastChild as Text
        const startTextNode = range.startContainer as Text
        const startOffset = range.startOffset
        // 创建一个新的range，从lastTextNode开始，到selection的end 并选中range的文本
        try {
          const newRange = new Range()
          newRange.setStart(startTextNode, startOffset)
          newRange.setEnd(lastTextNode, lastTextNode.length)
          selection.removeAllRanges()
          selection.addRange(newRange)
        } catch {
          resetBubbleMenu()
          return
        }
      }
    }
    const rect = range.getBoundingClientRect()
    updateBubbleMenuPosition({ rect, pageX, pageY, isHighlight: false })
  })

  usePDFEvent(
    [
      PDFViewerEvent.ScaleChanging,
      PDFViewerEvent.SpreadModeChanged,
      PDFViewerEvent.PagesDestroy,
    ],
    () => {
      resetBubbleMenu()
    },
  )

  const childrenProps = useMemo(() => {
    return {
      resetBubbleMenu,
      isHighlight,
      currentHighlight,
      enableTranslate,
    }
  }, [resetBubbleMenu, isHighlight, currentHighlight, enableTranslate])

  return (
    <motion.div
      ref={bubbleMenuRef}
      // 阻止选中状态被清空
      onMouseDown={(e) => e.preventDefault()}
      className={cn('invisible absolute top-0 left-0', className)}
    >
      {children(childrenProps)}
    </motion.div>
  )
}

export const BubbleMenu = (props: BubbleMenuProps) => {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const container =
    typeof props.container === 'function' ? props.container() : props.container

  return ReactDOM.createPortal(
    <BubbleMenuComponent {...props} />,
    container || document.body,
  )
}
