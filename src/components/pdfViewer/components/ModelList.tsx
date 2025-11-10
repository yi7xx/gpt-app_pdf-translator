import useI18n from '@/hooks/useI18n'
import { cn } from '@/utils/cn'
import { memo, useMemo, type FC } from 'react'
import { useDocumentContext } from '../context/DocumentContext'
import {
  TranslateType,
  type TranslateOption,
} from '../services/TranslationService'

interface ModelListProps {
  // 是否支持全局翻译，反之为单行翻译
  isGlobalTranslation?: boolean
  activeModel: string
  onChange: (option: TranslateOption) => void
}

const ModelList: FC<ModelListProps> = ({
  isGlobalTranslation = true,
  activeModel,
  onChange,
}) => {
  const { t } = useI18n()
  const { translationService } = useDocumentContext()

  const modelOptions = useMemo(() => {
    const options = translationService.options
    // 根据类型分组
    const modalMap = options.reduce(
      (acc, option) => {
        if (isGlobalTranslation) {
          if (!option.enableFullText) {
            return acc
          }
        } else {
          if (!option.enableSingleLine) {
            return acc
          }
        }
        // 自定义的优先级 custom 高于type
        const type = option.category || option.type
        if (!acc[type]) {
          acc[type] = []
        }
        acc[type]!.push(option)
        return acc
      },
      {} as Record<string, TranslateOption[]>,
    )
    return Object.entries(modalMap)
  }, [translationService, isGlobalTranslation])

  const typeI18n = useMemo(() => {
    const categoryDisplaynamies: Record<string, string> = {
      [TranslateType.FREE]: t('pdfViewer.tools.free'),
      [TranslateType.BASIC]: t('pdfViewer.tools.basic'),
      [TranslateType.ADVANCED]: t('pdfViewer.tools.advanced'),
    }

    for (const [type, option] of modelOptions) {
      if (!categoryDisplaynamies[type]) {
        categoryDisplaynamies[type] = option[0]?.categoryDisplayname || type
      }
    }

    return categoryDisplaynamies
  }, [modelOptions, t])

  return (
    <div className="flex flex-col gap-[2px] select-none">
      {modelOptions.map(([type, options]) => (
        <div className="flex flex-col gap-[2px]" key={type}>
          {(type !== TranslateType.FREE || options.length > 1) && (
            <div className="text-text-primary-4 font-normal-11 px-[9px] py-[8px] pb-[4px]">
              {typeI18n[type]}
            </div>
          )}
          {options.map((option) => (
            <div
              key={option.name}
              onClick={() => onChange(option)}
              className={cn(
                'font-normal-14 f-i-center cursor-pointer gap-[6px] rounded-[8px] px-[8px] py-[6px] transition-colors',
                activeModel === option.name
                  ? 'bg-brand-primary-focus'
                  : 'bg-grey-fill1-normal hover:bg-grey-fill1-hover',
              )}
            >
              <div className="flex-center size-[16px] shrink-0 text-[16px]">
                {option.icon}
              </div>
              <span className="text-text-primary-1 line-clamp-1 w-0 flex-1">
                {option.displayName || option.name}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default memo(ModelList)
