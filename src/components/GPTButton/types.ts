import { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'sec-destructive'
  | 'text'
export type ButtonSize = 'default' | 'small'
export type IconPosition = 'left' | 'right'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children?: ReactNode
  disabled?: boolean
  loading?: boolean | { delay?: number; icon?: ReactNode }
  icon?: ReactNode
  iconPosition?: IconPosition
  block?: boolean
  classNames?: {
    icon?: string
  }
  styles?: {
    icon?: React.CSSProperties
  }
}
