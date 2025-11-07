import { cn } from '@/utils/cn'
import React, { createContext } from 'react'
import {
  buttonGroupPrefixCls,
  prefixCls,
  type ButtonSize,
} from './buttonHelpers'

interface GroupContextType {
  size?: ButtonSize
  splitColor?: string
  isFirstItem?: boolean
  isLastItem?: boolean
}

const ButtonCompactItemContext = createContext<GroupContextType | null>(null)

const CompactItem: React.FC<React.PropsWithChildren<GroupContextType>> = (
  props,
) => {
  const { children, ...others } = props
  return (
    <ButtonCompactItemContext.Provider
      value={React.useMemo<GroupContextType>(() => others, [others])}
    >
      {children}
    </ButtonCompactItemContext.Provider>
  )
}

/**
 * 获取按钮组上下文
 */
export const useButtonItemContext = () => {
  const compactItemContext = React.useContext(ButtonCompactItemContext)

  const compactItemClassnames = React.useMemo<string>(() => {
    if (!compactItemContext) {
      return ''
    }
    const { isFirstItem, isLastItem } = compactItemContext

    return cn(`${prefixCls}-compact-item`, {
      [`${prefixCls}-compact-first-item`]: isFirstItem,
      [`${prefixCls}-compact-last-item`]: isLastItem,
    })
  }, [compactItemContext])

  return {
    splitColor: compactItemContext?.splitColor,
    compactSize: compactItemContext?.size,
    compactItemClassnames,
  }
}

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: ButtonSize
  block?: boolean
  splitColor?: string
}

const REACT_FRAGMENT_TYPE = Symbol.for('react.fragment')
const isFragment = (element: React.ReactNode) => {
  // @ts-ignore
  return React.isValidElement(element) && element.type === REACT_FRAGMENT_TYPE
}

const toArray = (children: React.ReactNode): React.ReactElement[] => {
  let ret: React.ReactElement[] = []

  React.Children.forEach(children, (child: any | any[]) => {
    if (child === undefined || child === null) {
      return
    }
    if (Array.isArray(child)) {
      ret = ret.concat(toArray(child))
    } else if (isFragment(child) && child.props) {
      ret = ret.concat(toArray(child.props.children))
    } else {
      ret.push(child)
    }
  })

  return ret
}

const ButtonGroup: React.FC<ButtonGroupProps> = (props) => {
  const {
    size,
    children,
    block = false,
    className,
    splitColor,
    ...restProps
  } = props

  const compactItemContext = React.useContext(ButtonCompactItemContext)

  const childNodes = toArray(children)

  const clx = cn(
    buttonGroupPrefixCls,
    {
      [`${buttonGroupPrefixCls}-block`]: block,
    },
    className,
  )

  const nodes = React.useMemo(
    () =>
      childNodes.map((child, i) => {
        const key = child?.key || `${buttonGroupPrefixCls}-item-${i}`
        return (
          <CompactItem
            key={key}
            size={size}
            splitColor={splitColor}
            isFirstItem={
              i === 0 &&
              (!compactItemContext || compactItemContext?.isFirstItem)
            }
            isLastItem={
              i === childNodes.length - 1 &&
              (!compactItemContext || compactItemContext?.isLastItem)
            }
          >
            {child}
          </CompactItem>
        )
      }),
    [childNodes, size, splitColor, compactItemContext],
  )

  // // =========================== Render ===========================
  if (childNodes.length === 0) {
    return null
  }

  return (
    <div className={clx} {...restProps}>
      {nodes}
    </div>
  )
}

export default ButtonGroup
