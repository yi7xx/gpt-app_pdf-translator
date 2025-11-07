import { cn } from '@/utils/cn'
import { Loading } from '@sider/icons'
import React, { useEffect, useMemo, useState } from 'react'
import type { ButtonProps } from './types'

import './button.css'

export type {
  ButtonProps,
  ButtonSize,
  ButtonVariant,
  IconPosition,
} from './types'

const prefixCls = 'gpt-btn'

const normalizeLoading = (loading: ButtonProps['loading']) => {
  if (typeof loading === 'object' && loading) {
    let delay = loading?.delay
    delay = !Number.isNaN(delay) && typeof delay === 'number' ? delay : 0
    return { loading: delay <= 0, delay, icon: loading.icon }
  }
  return { loading: !!loading, delay: 0, icon: undefined }
}

const GPTButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    const {
      variant = 'default',
      size = 'default',
      children,
      disabled = false,
      loading = false,
      icon,
      iconPosition = 'left',
      className,
      classNames,
      styles,
      block = false,
      style,
      ...restProps
    } = props

    // ====================== 处理 loading 状态 ======================
    const loadingOrDelay = useMemo(() => normalizeLoading(loading), [loading])
    const [innerLoading, setLoading] = useState(loadingOrDelay.loading)

    useEffect(() => {
      let delayTimer: NodeJS.Timeout | null = null
      if (loadingOrDelay.delay > 0) {
        delayTimer = setTimeout(() => {
          delayTimer = null
          setLoading(true)
        }, loadingOrDelay.delay)
      } else {
        setLoading(loadingOrDelay.loading)
      }
      return function cleanupTimer() {
        if (delayTimer) {
          clearTimeout(delayTimer)
          delayTimer = null
        }
      }
    }, [loadingOrDelay])

    const isDisabled = disabled || innerLoading

    // ====================== 处理图标 ======================
    const iconClasses = cn(`${prefixCls}-icon`, classNames?.icon)
    const iconStyle = styles?.icon

    const loadingIcon = <Loading className="shrink-0 animate-spin" />

    const iconNode = useMemo(() => {
      if (innerLoading) {
        return (
          <span className={iconClasses} style={iconStyle}>
            {loadingOrDelay.icon || loadingIcon}
          </span>
        )
      }

      if (icon) {
        return (
          <span className={iconClasses} style={iconStyle}>
            {icon}
          </span>
        )
      }
      return null
    }, [icon, innerLoading, loadingOrDelay.icon, iconClasses, iconStyle])

    // ====================== 处理按钮样式 ======================
    const buttonClasses = cn(
      prefixCls,
      `${prefixCls}-${variant}`,
      {
        [`${prefixCls}-${size}`]: size !== 'default' && size,
        [`${prefixCls}-icon-only`]: !children && children !== 0 && !!iconNode,
        [`${prefixCls}-loading`]: innerLoading,
        [`${prefixCls}-block`]: block,
        [`${prefixCls}-icon-${iconPosition}`]:
          iconPosition !== 'left' && iconPosition,
      },
      className,
    )

    return (
      <button
        {...restProps}
        ref={ref}
        type={restProps.type || 'button'}
        style={style}
        className={buttonClasses}
        disabled={isDisabled}
      >
        {iconNode}
        {children}
      </button>
    )
  },
)

GPTButton.displayName = 'GPTButton'

export default GPTButton
