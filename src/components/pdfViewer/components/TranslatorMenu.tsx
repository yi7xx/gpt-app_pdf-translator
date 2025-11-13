import GPTButton from '@/components/GPTButton'
import LanguageSelect from '@/components/LanguageSelect'
import useI18n from '@/hooks/useI18n'
import { cn } from '@/utils/cn'
import { DownMd, TranslateLite } from '@sider/icons'
import { useUpdate } from 'ahooks'
import { Popover, Switch } from 'antd'
import { memo, useEffect, useRef, useState } from 'react'
import { useDocumentContext } from '../context/DocumentContext'
import { PDFViewerEvent } from '../events'
import { usePDFEvent } from '../hooks/usePDFEvent'
import {
  TranslateType,
  type TranslateOption,
} from '../services/TranslationService'

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
  const { t } = useI18n()

  const [loaded, setLoaded] = useState(false)

  usePDFEvent(PDFViewerEvent.DocumentInit, () => {
    setLoaded(true)
  })

  // 是否处于打印模式
  const [isPrinting, setIsPrinting] = useState(false)

  usePDFEvent(PDFViewerEvent.PrintingChanged, ({ isPrinting }) => {
    setIsPrinting(isPrinting)
  })

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

  const handleGetBetterClick = () => {
    // TODO: open sider
    setPopoverOpen(false)
    window.open('https://sider.ai/wisebase', '_blank')
  }

  const update = useUpdate()
  // 点击模型列表时，更新组件来确保ref生效
  useEffect(() => {
    if (modelListOpen) {
      update()
    }
  }, [modelListOpen, update])

  return (
    <div className="f-i-center h-[32px]">
      <GPTButton
        variant="secondary"
        disabled={!loaded}
        className={cn(
          'rounded-r-none',
          enableTrans.current && 'text-interactive-icon-accent-default',
        )}
        icon={<TranslateLite size={14} />}
        onClick={() => toggleTranslateService(!enableTrans.current)}
      >
        {enableTrans.current
          ? t('pdfViewer.tools.close-trans')
          : t('pdfViewer.tools.translate')}
      </GPTButton>
      <Popover
        open={popoverOpen}
        trigger={'click'}
        onOpenChange={setPopoverOpen}
        styles={{ body: { width: 260, padding: 0, borderRadius: 16 } }}
        arrow={false}
        placement="bottomRight"
        destroyOnHidden
        getPopupContainer={(node) => node.parentElement!}
        content={
          <div className="size-full">
            <div className="w-full p-1.5">
              <div className="f-i-center h-9 w-full ps-2.5 pe-2">
                <span className="font-normal-13 text-interactive-label-secondary-default">
                  {t('pdfViewer.tools.compare')}
                </span>
                <Switch
                  className="ms-auto w-8 shrink-0"
                  checked={compareEnabled.current}
                  onChange={handleCompareChange}
                />
              </div>

              <div className="border-border-default my-1.5 w-full border-t" />

              <div className="space-y-2 px-2.5 py-2">
                <div className="text-text-tertiary font-normal-14">
                  {t('pdfViewer.tools.translated-to')}
                </div>
                <LanguageSelect
                  value={toLang.current}
                  onChange={(item) => handleToLangChange(item.code)}
                />
              </div>
            </div>
            <div
              className="f-i-center bg-brand-primary-bg text-brand-secondary-normal h-11 cursor-pointer gap-1 rounded-b-2xl px-4"
              onClick={handleGetBetterClick}
            >
              <div className="font-normal-12 -tracking-[0.1px] whitespace-nowrap">
                {t('pdfViewer.tools.get-better')}
              </div>
              <span className="shrink-0 -rotate-90">
                <DownMd size={14}></DownMd>
              </span>
            </div>
          </div>
        }
      >
        <GPTButton
          variant="secondary"
          className="rounded-l-none rounded-r-full border-l-0"
          icon={<DownMd size={20} />}
        />
      </Popover>
    </div>
  )
}

export default memo(TranslatorMenu)
