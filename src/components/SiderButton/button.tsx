import { cn } from '@/utils/cn'
import { Loading } from '@sider/icons'
import React, { useEffect, useMemo, useState } from 'react'
import ButtonGroup, { useButtonItemContext } from './button-group'
import {
  prefixCls,
  type ButtonColorType,
  type ButtonHTMLType,
  type ButtonShape,
  type ButtonSize,
  type SiderButtonType,
} from './buttonHelpers'

import './button.css'

type MergedHTMLAttributes = Omit<
  React.ButtonHTMLAttributes<HTMLElement>,
  'type' | 'color'
>

export interface ButtonProps extends MergedHTMLAttributes {
  className?: string
  color?: ButtonColorType
  size?: ButtonSize
  shape?: ButtonShape
  type?: SiderButtonType
  disabled?: boolean
  children?: React.ReactNode
  icon?: React.ReactNode
  block?: boolean
  htmlType?: ButtonHTMLType
  // 图标位置
  iconPosition?: 'start' | 'end'
  loading?: boolean | { delay?: number; icon?: React.ReactNode }
  [key: `[data-${string}]`]: string
  // 子元素样式
  classNames?: { icon?: string }
  styles?: { icon?: React.CSSProperties }
}

const normalizeLoading = (loading: ButtonProps['loading']) => {
  if (typeof loading === 'object' && loading) {
    let delay = loading?.delay
    delay = !Number.isNaN(delay) && typeof delay === 'number' ? delay : 0
    return { loading: delay <= 0, delay }
  }
  return { loading: !!loading, delay: 0 }
}

const InternalCompoundedButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>((props, ref) => {
  const {
    className,
    color = 'grey',
    icon,
    size: customSize = 'middle',
    type = 'default',
    shape = 'default',
    disabled = false,
    loading = false,
    style,
    styles,
    block = false,
    htmlType,
    classNames,
    iconPosition = 'start',
    children,
    ...restProps
  } = props

  // ====================== 按钮组处理 ======================
  const { compactSize, compactItemClassnames, splitColor } =
    useButtonItemContext()
  const sizeCls = compactSize || customSize

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

  const iconClasses = cn(`${prefixCls}-icon`, classNames?.icon)
  const iconStyle = styles?.icon

  const iconNode = useMemo(
    () =>
      icon && !innerLoading ? (
        <span className={iconClasses} style={iconStyle}>
          {icon}
        </span>
      ) : loading && typeof loading === 'object' && loading.icon ? (
        <span className={iconClasses} style={iconStyle}>
          {loading.icon}
        </span>
      ) : innerLoading ? (
        <span className={iconClasses} style={iconStyle}>
          <Loading className={cn('shrink-0 animate-spin')} />
        </span>
      ) : null,
    [icon, innerLoading, loading, iconClasses, iconStyle],
  )

  // ====================== 处理按钮样式 ======================
  const classes = cn(
    prefixCls,
    {
      [`${prefixCls}-${shape}`]: shape !== 'default' && shape,
      [`${prefixCls}-${sizeCls}`]: sizeCls,
      [`${prefixCls}-${type}`]: type !== 'default' && type,
      [`${prefixCls}-icon-only`]: !children && children !== 0 && !!iconNode,
      [`${prefixCls}-${color}`]: color !== 'grey' && color,
      [`${prefixCls}-loading`]: innerLoading,
      [`${prefixCls}-block`]: block,
      [`${prefixCls}-icon-${iconPosition}`]:
        iconPosition !== 'start' && iconPosition,
    },
    compactItemClassnames,
    className,
  )
  const mergedStyle = {
    ...style,
    '--btn-split-color': splitColor ?? '',
  } as React.CSSProperties

  return (
    <button
      {...restProps}
      ref={ref}
      type={htmlType}
      style={mergedStyle}
      className={classes}
      disabled={disabled}
    >
      {iconNode}
      {children}
    </button>
  )
})

type ButtonType = typeof InternalCompoundedButton & {
  Group: typeof ButtonGroup
}

InternalCompoundedButton.displayName = 'Button'

const Button = InternalCompoundedButton as ButtonType

Button.Group = ButtonGroup

export default Button
