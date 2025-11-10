import { CheckMd, DownMd } from '@/packages/icons'
import { cn } from '@/utils/cn'
import { LanguagesList, type Languages } from '@/utils/languages'
import { useUpdateEffect } from 'ahooks'
import { Dropdown } from 'antd'
import { memo, useMemo, useState, type FC } from 'react'

interface LanguageSelectProps {
  className?: string
  onChange: (item: Languages) => void
  isAuto?: boolean
  value?: string
}

const LanguageSelect: FC<LanguageSelectProps> = ({
  className,
  isAuto = false,
  value,
  onChange,
}) => {
  const [open, setOpen] = useState(false)
  const [language, setLanguage] = useState<string>(value || '')

  const languageMerged = value || language

  const extendedLanguagesList = useMemo(() => {
    if (isAuto) {
      return [
        {
          language: 'Auto Detect',
          code: 'auto',
          ename: 'Auto Detect',
        },
        ...LanguagesList,
      ]
    }
    return LanguagesList
  }, [isAuto])

  const selectedValue = useMemo(() => {
    return (
      extendedLanguagesList.find(
        (v) => v.code === languageMerged || v.language === languageMerged,
      )?.language || ''
    )
  }, [extendedLanguagesList, languageMerged])

  useUpdateEffect(() => {
    setLanguage(value || '')
  }, [value])

  const handleChange = (item: Languages) => {
    setOpen(false)
    setLanguage(item.code)
    onChange(item)
  }
  return (
    <Dropdown
      open={open}
      trigger={['click']}
      onOpenChange={setOpen}
      destroyOnHidden
      popupRender={() => (
        <div className="border-border-default bg-bg-elevated-primary shadow-black-middle w-57 rounded-[20px] border">
          <div
            className="custom-scrollbar custom-scrollbar-float custom-scrollbar-hidden max-h-84 w-full overflow-x-hidden overflow-y-auto py-1.5 ps-1.5"
            style={
              {
                '--scrollbar-margin-block': '12px',
                scrollbarGutter: 'stable',
              } as React.CSSProperties
            }
          >
            {extendedLanguagesList.map((item) => {
              return (
                <div
                  key={item.code}
                  className="f-i-center bg-interactive-bg-secondary-default hover:bg-interactive-bg-secondary-hover h-9 cursor-pointer gap-1.5 rounded-md px-2.5 transition-colors"
                  onClick={() => handleChange(item)}
                >
                  {/* <span className="font-semibold-13 text-interactive-label-secondary-default">
                    {item.ename}
                  </span> */}
                  <span className="font-normal-13 text-text-tertiary">
                    {item.language}
                  </span>
                  {item.code === languageMerged && (
                    <CheckMd size={18} className="text-icon-primary ms-auto" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    >
      <div
        className={cn(
          'font-normal-14 f-i-center bg-bg-tertiary h-[38px] cursor-pointer gap-1.5 rounded-lg px-3 select-none',
          className,
        )}
      >
        <span className="text-text-primary w-0 flex-1 truncate">
          {selectedValue}
        </span>
        <DownMd
          size={16}
          className={cn(
            'text-icon-tertiary transition-transform',
            open && 'rotate-180',
          )}
        />
      </div>
    </Dropdown>
  )
}

export default memo(LanguageSelect)
