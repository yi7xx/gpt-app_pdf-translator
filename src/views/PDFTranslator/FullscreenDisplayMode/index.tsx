import { useMaxHeight } from '@/hooks/openai'
import { useLayoutEffect, useRef } from 'react'
import PDFViewer from './PDFViewer'

const CHATGPT_INPUT_HIGHT = 100

const FullscreenDisplayMode = () => {
  const maxHeight = useMaxHeight()

  const containerRef = useRef<HTMLDivElement>(null)

  const computedContainerHeight = () => {
    const container = containerRef.current
    if (!container) return
    const bodyHeight = document.body.clientHeight
    container.style.maxHeight = maxHeight
      ? `${maxHeight}px`
      : `${bodyHeight - CHATGPT_INPUT_HIGHT}px`
  }

  useLayoutEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver(computedContainerHeight)
    resizeObserver.observe(containerRef.current!)
    return () => resizeObserver.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="flex w-full flex-col">
      <div className="grid flex-1 grid-rows-[auto] overflow-hidden">
        <PDFViewer className="min-h-0" />
      </div>
    </div>
  )
}

export default FullscreenDisplayMode
