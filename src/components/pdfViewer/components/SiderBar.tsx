import { cn } from '@/utils/cn'
import { useLocalStorageState } from '@sider/hooks'
import { motion } from 'motion/react'
import { useEffect, useState, useTransition } from 'react'
import { PDF_ACTION_TOOL_STORAGE_KEY } from '../constants'
import { useDocumentContext } from '../context/DocumentContext'
import { PDFViewerEvent, UIEvents } from '../events'
import { usePDFEvent } from '../hooks/usePDFEvent'
import { HighlightList } from './HighlightList'
import ThumbnailList from './ThumbnailList'

/**
 * 侧边栏
 * 工具组件不能被卸载，在外层进行动画
 */

const PADDING = 12

const ActionWidthMap: Record<string, number> = {
  'hide-bar': 0,
  thumbnail: 100 + PADDING,
  highlight: 180 + PADDING,
}

export const SiderBar = () => {
  const { eventBus } = useDocumentContext()
  const [actionTool, setActionTool] = useLocalStorageState(
    PDF_ACTION_TOOL_STORAGE_KEY,
    { defaultValue: 'thumbnail', listenStorageChange: true },
  )
  const [isPending, startTransition] = useTransition()

  const [width, setWidth] = useState(ActionWidthMap[actionTool!])

  // 防止 Hydration 问题
  useEffect(() => {
    setWidth(ActionWidthMap[actionTool!])
  }, [actionTool])

  usePDFEvent(UIEvents.ActionChanging, ({ action }) => {
    startTransition(() => {
      setActionTool(action)
    })
  })

  const handleAnimationComplete = () => {
    eventBus.emit(PDFViewerEvent.PageResize, {
      source: actionTool,
    })
  }

  const computedStyle = (current: string) => {
    if (actionTool === 'hide-bar') {
      return 'invisible'
    }
    return current === actionTool ? 'z-[1] left-0 top-0' : 'hidden'
  }

  return (
    <motion.div
      className="relative h-full shrink-0 overflow-hidden contain-layout"
      animate={{ width }}
      initial={false}
      transition={{ type: 'tween', duration: 0.15 }}
      onAnimationComplete={handleAnimationComplete}
      style={{
        willChange: 'width',
        visibility: width === 0 ? 'hidden' : 'visible',
      }}
    >
      <div
        className={cn('absolute inset-0 size-full', computedStyle('thumbnail'))}
      >
        <ThumbnailList />
      </div>
      <div
        className={cn('absolute inset-0 size-full', computedStyle('highlight'))}
      >
        <HighlightList />
      </div>
    </motion.div>
  )
}
