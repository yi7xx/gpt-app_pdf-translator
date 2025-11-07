import { type HandlerEvent } from '@/utils/mitter'
import { useMemoizedFn } from 'ahooks'
import { useEffect } from 'react'
import { useDocumentContext } from '../context/DocumentContext'
import { type PDFEventMap } from '../events'

/**
 * 订阅事件并在组件卸载时自动取消订阅
 */
export const usePDFEvent = <T extends keyof PDFEventMap>(
  event: T | T[],
  handler: HandlerEvent<T, PDFEventMap>,
) => {
  const { eventBus } = useDocumentContext()
  const eventHandler = useMemoizedFn(handler)
  const events = Array.isArray(event) ? event : [event]

  useEffect(() => {
    const subscribe = (e: T) => eventBus.on(e, eventHandler)
    const unsubscribe = (e: T) => eventBus.off(e, eventHandler)

    events.forEach(subscribe)
    return () => {
      events.forEach(unsubscribe)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventBus, eventHandler, ...events])
}
