import { cn } from '@/utils/cn'
import './index.css'

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export default function GPTSkeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton-shimmer rounded-lg', className)}
      style={style}
    />
  )
}
