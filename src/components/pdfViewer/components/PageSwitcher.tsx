import GPTButton from '@/components/GPTButton'
import useI18n from '@/hooks/useI18n'
import { cn } from '@/utils/cn'
import { ArrowLineB, ArrowLineT } from '@sider/icons'
import { useKeyPress } from 'ahooks'
import { Tooltip } from 'antd'
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
  const { t } = useI18n()
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

  const handleInputBlur = () => {
    handlePageChange(page)
    inputRef.current?.blur()
  }
  const handleFocus = () => {
    setTimeout(() => inputRef.current?.focus(), 0)
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
    <div className="f-i-center gap-1">
      <Tooltip title={t('pdfViewer.tools.pre-page')} arrow={false}>
        <GPTButton
          variant="text"
          onClick={() => handlePageChange((page || 0) - 1)}
          icon={<ArrowLineT size={20} />}
          disabled={page === 1}
        />
      </Tooltip>
      <div className="f-i-center">
        <div
          className={cn(
            'flex-center text-text-primary bg-bg-tertiary box-content h-[28px] min-w-14 flex-1 cursor-text rounded-full border border-transparent transition-all',
            'focus-within:border-text-primary',
          )}
          onClick={handleFocus}
        >
          <div className="font-normal-14 inline-flex" ref={boxRef}>
            <input
              type="text"
              className="size-full bg-transparent text-inherit outline-none"
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
        <span className="font-normal-14 text-text-tertiary ms-[9px] shrink-0 text-nowrap">
          / {numPages}
        </span>
      </div>
      <Tooltip title={t('pdfViewer.tools.next-page')} arrow={false}>
        <GPTButton
          variant="text"
          onClick={() => handlePageChange((page || 0) + 1)}
          icon={<ArrowLineB size={20} />}
          disabled={page === numPages}
        />
      </Tooltip>
    </div>
  )
}

export default PageSwitcher
