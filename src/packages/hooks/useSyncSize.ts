import { useEffect, useMemo, useRef, type RefObject } from 'react'

/**
 * 同步监听目标元素尺寸变更
 * 当目标元素发生尺寸变更时,回调函数会被执行
 * @param target 目标元素
 * @param callback 尺寸变更回调
 */
export const useSyncSize = <E extends HTMLElement | null>(
  target: RefObject<E>,
  callback: (width: number, height: number) => void,
) => {
  const callbackLast = useRef(callback)
  callbackLast.current = callback

  const observer = useMemo(() => {
    if (typeof window === 'undefined') return null
    return new ResizeObserver(() => {
      if (!target.current) return
      callbackLast.current(
        target.current.clientWidth,
        target.current.clientHeight,
      )
    })
  }, [])

  const lastTarget = useRef<E | null>(null)

  useEffect(() => {
    if (target.current === lastTarget.current || !target.current) {
      return
    }
    lastTarget.current = target.current
    observer?.observe(target.current)
  })

  useEffect(() => {
    return () => {
      observer?.disconnect()
      lastTarget.current = null
    }
  }, [])
}
