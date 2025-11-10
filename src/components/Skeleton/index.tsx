'use client'

import { cn } from '@/utils/cn'
import { type FC, useEffect, useState } from 'react'
import './index.css'

interface SkeletonProps {
  className?: string
  width?: number | string
  height?: number | string
  radius?: number | string
  delay?: number
}

/**
 * 统一骨架屏
 */
const Skeleton: FC<SkeletonProps> = ({
  className,
  width,
  height,
  radius,
  delay = 0,
}) => {
  const [isClient, setIsClient] = useState(true)
  useEffect(() => {
    setIsClient(true)
  }, [])
  return (
    <div
      className={cn('skeleton size-full', className)}
      style={{
        width,
        height,
        borderRadius: radius,
        // animationDelay: `${delay}s`,
        animationPlayState: isClient ? 'running' : 'paused',
      }}
    ></div>
  )
}

export default Skeleton
