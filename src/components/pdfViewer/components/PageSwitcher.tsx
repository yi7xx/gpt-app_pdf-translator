import { cn } from '@/utils/cn'
import { ArrowLineB, ArrowLineT } from '@sider/icons'
import { useKeyPress } from 'ahooks'
import { Tooltip } from 'antd'
import { useTranslations } from 'next-intl'
import { useEffect, useLayoutEffect, useRef, useState, type FC } from 'react'

interface PageSwitcherProps {
  numPages: number
  nowPage: number
  onPageChange: (page: number) => void
}

const PageSwitcher: FC<PageSwitcherProps> = ({
  numPages,
  nowPage,
  onPageChange,
}) => {
  const t = useTranslations('ui.pdfViewer')
  const [page, setPage] = useState<number>(nowPage)
  useEffect(() => {
    setPage(nowPage)
  }, [nowPage])

  const handlePageChange = (page?: number) => {
    page = page || 1
    const newPage = Math.max(1, Math.min(page, numPages))
    setPage(newPage)
    onPageChange(newPage)
  }

  const boxRef = useRef<HTMLDivElement>(null)
  const mirrorRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '') {
      setPage('' as any)
      return
    }
    if (/^\d*$/.test(value)) {
      const newPage = Math.max(1, Math.min(parseInt(value) || 1, numPages))
      setPage(newPage)
    }
  }

  const [focus, setFocus] = useState(false)

  const handleInputBlur = () => {
    handlePageChange(page)
    setFocus(false)
    inputRef.current?.blur()
  }
  const handleFocus = () => {
    setTimeout(() => inputRef.current?.focus(), 0)
    setFocus(true)
  }

  useLayoutEffect(() => {
    if (!mirrorRef.current || !boxRef.current) return
    const width = Math.max(mirrorRef.current.clientWidth, 5)
    boxRef.current.style.width = `${width}px`
  }, [page])

  useKeyPress(
    34,
    (e: KeyboardEvent) => {
      e.preventDefault()
      handlePageChange((page || 0) + 1)
    },
    {
      exactMatch: true,
      useCapture: true,
    },
  )

  useKeyPress(
    33,
    (e: KeyboardEvent) => {
      e.preventDefault()
      handlePageChange((page || 0) - 1)
    },
    {
      exactMatch: true,
      useCapture: true,
    },
  )

  useKeyPress('enter', handleInputBlur, {
    target: inputRef,
    exactMatch: true,
    useCapture: true,
  })

  return (
    <div className="bg-color-grey-fill2-normal flex h-[32px] rounded-[8px]">
      <Tooltip title={t('tools.pre-page')}>
        <div
          className={cn(
            'rounded-l-[8px] p-[8px] transition-colors',
            page === 1
              ? 'text-color-text-primary-5 cursor-not-allowed'
              : 'text-color-text-primary-1 hover:bg-color-grey-fill2-hover cursor-pointer',
          )}
          onClick={() => handlePageChange((page || 0) - 1)}
        >
          <ArrowLineT size={16} />
        </div>
      </Tooltip>
      <div className="bg-color-grey-fill2-normal h-full w-[1px] shrink-0"></div>
      <div
        className={cn(
          'f-i-center box-border shrink-0 gap-[8px] border-[1px] border-solid px-[12px] py-[6px] transition-colors',
          focus
            ? 'border-color-brand-primary-normal bg-color-grey-layer2-normal'
            : 'hover:bg-color-grey-fill2-hover border-transparent',
        )}
        style={{
          boxShadow: focus
            ? ' 0px 0px 0px 3px var(--color-focus-primary-1)'
            : '',
        }}
        onClick={handleFocus}
      >
        <div className="flex-center min-w-[20px] flex-1 cursor-text">
          <div
            className="text-color-text-primary-1 font-normal-14 inline-flex w-min"
            ref={boxRef}
          >
            <input
              type="text"
              className="h-full w-full bg-transparent text-inherit outline-none"
              value={page}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              ref={inputRef}
              pattern="\d*"
            />
            <span
              className="invisible absolute top-0 left-0 -z-10 whitespace-pre"
              ref={mirrorRef}
            >
              {page}
            </span>
          </div>
        </div>
        <span className="text-color-text-primary-4 font-normal-12 shrink-0 text-nowrap">
          / {numPages}
        </span>
      </div>
      <div className="bg-color-grey-fill2-normal h-full w-[1px] shrink-0"></div>
      <Tooltip title={t('tools.next-page')}>
        <div
          className={cn(
            'rounded-r-[8px] p-[8px] transition-colors',
            page === numPages
              ? 'text-color-text-primary-5 cursor-not-allowed'
              : 'text-color-text-primary-1 hover:bg-color-grey-fill2-hover cursor-pointer',
          )}
          onClick={() => handlePageChange((page || 0) + 1)}
        >
          <ArrowLineB size={16} />
        </div>
      </Tooltip>
    </div>
  )
}

export default PageSwitcher
