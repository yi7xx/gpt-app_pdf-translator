import { cn } from '@/utils/cn'
import { ArrowOutlineSB, ExclamationMark, TranslateLite } from '@sider/icons'
import LanguageSelect from '@sider/ui/languageSelect'
import { useClickAway, useUpdate } from 'ahooks'
import { Popover, Select, Switch, Tooltip } from 'antd'
import { useTranslations } from 'next-intl'
import { memo, useEffect, useRef, useState } from 'react'
import { useDocumentContext } from '../context/DocumentContext'
import { PDFViewerEvent } from '../events'
import { usePDFEvent } from '../hooks/usePDFEvent'
import {
  TranslateType,
  type TranslateOption,
} from '../services/TranslationService'
import ModelList from './ModelList'

/**
 * 同步更新状态
 */
const useRefState = <T,>(initialValue: T) => {
  const ref = useRef(initialValue)
  const [, update] = useState({})
  const setValue = (value: T) => {
    ref.current = value
    update({})
  }
  return [ref, setValue] as const
}

const TranslatorMenu = ({
  showTranslateName,
}: {
  showTranslateName: boolean
}) => {
  const { translationService, onGlobalModelChange } = useDocumentContext()
  const t = useTranslations('ui.pdfViewer.tools')

  const [loaded, setLoaded] = useState(false)

  usePDFEvent(PDFViewerEvent.DocumentInit, () => {
    setLoaded(true)
  })

  // 是否处于打印模式
  const [isPrinting, setIsPrinting] = useState(false)

  usePDFEvent(PDFViewerEvent.PrintingChanged, ({ isPrinting }) => {
    setIsPrinting(isPrinting)
  })

  const popoverRef = useRef<HTMLDivElement[]>([])
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [modelListOpen, setModelListOpen] = useState(false)

  const cacheTranslateRef = useRef({ ...translationService.translateInfo })
  const [pageCount, setPageCount] = useState(0)

  const [enableTrans, setEnableTrans] = useRefState(
    translationService.enableTranslateService,
  )
  const [compareEnabled, setCompareEnabled] = useRefState(
    translationService.translateInfo.compareEnabled,
  )
  const [fromLang, setFromLang] = useRefState(
    translationService.translateInfo.fromLang,
  )
  const [toLang, setToLang] = useRefState(
    translationService.translateInfo.toLang,
  )
  const [modelOption, setModelOption] = useRefState<TranslateOption>(
    translationService.translateInfo.modelOption,
  )

  usePDFEvent(PDFViewerEvent.DocumentInit, ({ source }) => {
    setPageCount(source.numPages)
  })

  usePDFEvent(PDFViewerEvent.PagesDestroy, ({ source }) => {
    cacheTranslateRef.current = { ...translationService.translateInfo }
    const { compareEnabled, fromLang, toLang, modelOption } =
      cacheTranslateRef.current
    setIsPrinting(false)
    setEnableTrans(translationService.enableTranslateService)
    setCompareEnabled(compareEnabled)
    setFromLang(fromLang)
    setToLang(toLang)
    setModelOption(modelOption)
    setPopoverOpen(false)
  })

  const toggleTranslateService = async (enable: boolean) => {
    if (!loaded) {
      return
    }
    const { fromLang, toLang, modelOption, compareEnabled } =
      cacheTranslateRef.current

    if (!(await onGlobalModelChange(modelOption))) {
      return
    }

    setEnableTrans(enable)
    translationService.toggleTranslateService(enable, {
      fromLang,
      toLang,
      modelOption,
      compareEnabled,
    })
  }

  // 当前是否为免费模型
  const isFreeTranslation = () => {
    return (
      modelOption.current.type === TranslateType.FREE ||
      modelOption.current.type === TranslateType.Custom
    )
  }

  // 免费模型触发翻译
  const triggerTranslate = (
    key: 'fromLang' | 'toLang' | 'modelOption',
    value: string | TranslateOption,
  ) => {
    if (!isFreeTranslation()) {
      return
    }
    cacheTranslateRef.current[key] = value as any
    if (enableTrans.current) {
      setPopoverOpen(false)
      toggleTranslateService(enableTrans.current)
    }
  }

  const handleFromLangChange = (value: string) => {
    setFromLang(value)
    triggerTranslate('fromLang', value)
  }

  const handleToLangChange = (value: string) => {
    setToLang(value)
    triggerTranslate('toLang', value)
  }

  const handleModelOptionChange = async (value: TranslateOption) => {
    setModelListOpen(false)
    if (await onGlobalModelChange(value)) {
      setModelOption(value)
      triggerTranslate('modelOption', value)
    } else {
      // 取消弹窗
      setPopoverOpen(false)
    }
  }

  const cancel = (e?: any) => {
    const { fromLang, toLang, modelOption, compareEnabled } =
      cacheTranslateRef.current
    setCompareEnabled(compareEnabled)
    setFromLang(fromLang)
    setToLang(toLang)
    setModelOption(modelOption)
    setPopoverOpen(false)
  }

  const handleCompareChange = (value: boolean) => {
    cacheTranslateRef.current.compareEnabled = value
    setCompareEnabled(value)
    if (enableTrans.current) {
      toggleTranslateService(enableTrans.current)
    }
  }

  const handleConfirm = () => {
    cacheTranslateRef.current = {
      fromLang: fromLang.current,
      toLang: toLang.current,
      modelOption: modelOption.current,
      compareEnabled: compareEnabled.current,
    }
    setPopoverOpen(false)
    if (enableTrans.current) {
      toggleTranslateService(enableTrans.current)
    }
  }

  const handleClickArrow = () => {
    if (isPrinting) {
      return
    }
    if (popoverOpen) {
      cancel()
    } else {
      setPopoverOpen(true)
    }
  }

  useClickAway(cancel, popoverRef.current)

  const update = useUpdate()
  // 点击模型列表时，更新组件来确保ref生效
  useEffect(() => {
    if (modelListOpen) {
      update()
    }
  }, [modelListOpen, update])

  return (
    <div className="f-i-center h-[32px]">
      <div
        onClick={() => toggleTranslateService(!enableTrans.current)}
        className={cn(
          'bg-color-grey-fill2-normal f-i-center hover:bg-color-grey-fill2-hover cursor-pointer gap-2 rounded-l-[8px] transition-colors',
          showTranslateName ? 'px-[16px] py-[6px]' : 'p-[9px]',
          loaded || 'cursor-not-allowed',
          enableTrans.current
            ? 'text-color-brand-secondary-normal'
            : 'text-color-text-primary-1',
        )}
      >
        <TranslateLite size={14} />
        {showTranslateName && (
          <span className="font-normal-14 whitespace-nowrap">
            {enableTrans.current ? t('close-trans') : t('translate')}
          </span>
        )}
      </div>
      <Popover
        open={popoverOpen}
        trigger={'click'}
        overlayInnerStyle={{
          width: 260,
          padding: 0,
          borderRadius: 16,
          background: 'var(--color-grey-layer3-normal)',
          boxShadow:
            '0px 6px 24px 0px rgba(12, 13, 25, 0.04), 0px 12px 48px 0px rgba(12, 13, 25, 0.04), 0px 24px 96px 0px rgba(12, 13, 25, 0.04)',
        }}
        arrow={false}
        destroyTooltipOnHide
        content={
          <div
            ref={(ref) => {
              if (ref) {
                popoverRef.current[0] = ref
              }
            }}
            className="relative flex flex-col gap-[4px] px-[8px] pt-[8px] pb-[16px]"
          >
            <div className="f-i-center px-[8px] py-[6px]">
              <span className="text-color-text-primary-1 font-normal-14 mr-auto">
                {t('compare')}
              </span>
              <Switch
                className="w-[28px]"
                size="small"
                checked={compareEnabled.current}
                onChange={handleCompareChange}
              />
            </div>
            <div className="border-color-grey-line1-normal mx-[9px] my-[6px] shrink-0 border-t" />
            <div className="mx-2 shrink-0">
              <div className="text-color-text-primary-3 font-normal-12 mb-1">
                {t('translate-service')}
              </div>
              <Select
                className="w-full"
                variant="filled"
                open={modelListOpen}
                value={modelOption.current}
                suffixIcon={
                  <span className="text-color-text-primary-3 flex-center">
                    <ArrowOutlineSB size={12} />
                  </span>
                }
                onDropdownVisibleChange={(visible) => setModelListOpen(visible)}
                getPopupContainer={() => popoverRef.current[0]!}
                dropdownRender={() => (
                  <div
                    className="w-full"
                    ref={(ref) => {
                      if (ref) {
                        popoverRef.current[3] = ref
                      }
                    }}
                  >
                    <ModelList
                      activeModel={modelOption.current.name}
                      onChange={handleModelOptionChange}
                    />
                  </div>
                )}
                labelRender={() => (
                  <div className="f-i-center shrink-0 gap-[7px]">
                    <span className="text-[16px]">
                      {modelOption.current.icon}
                    </span>
                    <span className="font-normal-14">
                      {modelOption.current.displayName ||
                        modelOption.current.name}
                    </span>
                  </div>
                )}
              />
            </div>

            <div className="mt-[4px] box-border flex w-full flex-col gap-[4px] px-[8px]">
              {/* 根据需求暂时不需要源语言 */}
              {/* <div className="text-color-text-primary-3 font-normal-12">
                {t('source-language')}
              </div>
              <LanguageSelect
                isAuto
                variant="filled"
                value={fromLang.current}
                onChange={(item) => handleFromLangChange(item.code)}
                getPopupContainer={() => popoverRef.current[0]!}
              /> */}
              <div className="text-color-text-primary-3 font-normal-12">
                {t('translated-to')}
              </div>
              <LanguageSelect
                variant="filled"
                value={toLang.current}
                onChange={(item) => handleToLangChange(item.code)}
                getPopupContainer={() => popoverRef.current[0]!}
              />
            </div>
            {isFreeTranslation() || (
              <div className="f-i-center px-[8px] pt-[4px]">
                <div className="f-i-center gap-[4px]">
                  <span className="text-color-text-primary-4">
                    <ExclamationMark size={12} />
                  </span>
                  <span className="text-color-text-primary-3 font-normal-12">
                    {t.rich(
                      modelOption.current.type === TranslateType.BASIC
                        ? 'cost-basic'
                        : 'cost-advanced',
                      {
                        count: () => (
                          <Tooltip
                            overlayInnerStyle={{
                              textAlign: 'center',
                              fontWeight: '400',
                            }}
                            title={t('cost-tooltip')}
                          >
                            <span className="text-color-brand-primary-normal cursor-pointer text-[12px] leading-[18px] font-[700]">
                              {pageCount}
                            </span>
                          </Tooltip>
                        ),
                      },
                    )}
                  </span>
                </div>
                <button
                  onClick={handleConfirm}
                  className="hover:bg-color-advanced-fil-hover bg-color-advanced-fill-normal ml-auto rounded-[6px] px-[12px] py-[2px] transition-colors"
                >
                  <span className="text-color-text-white-1 font-normal-12">
                    {t('confirm')}
                  </span>
                </button>
              </div>
            )}
          </div>
        }
      >
        <div
          ref={(ref) => {
            if (ref) {
              popoverRef.current[1] = ref
            }
          }}
          onClick={handleClickArrow}
          className={cn(
            'border-color-grey-fill2-normal rounded-r-[8px] border-l p-[10px] transition-colors',
            isPrinting
              ? 'bg-color-grey-fill2-normal text-color-text-primary-5 cursor-not-allowed'
              : 'bg-color-grey-fill2-normal text-color-text-primary-1 hover:bg-color-grey-fill2-hover cursor-pointer',
          )}
        >
          <ArrowOutlineSB size={12} />
        </div>
      </Popover>
    </div>
  )
}

export default memo(TranslatorMenu)
