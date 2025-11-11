import GPTButton from '@/components/GPTButton'
import { useOpenExternal } from '@/hooks/openai'
import useI18n from '@/hooks/useI18n'
import { cn } from '@/utils/cn'
import { useLocalStorageState } from '@sider/hooks'
import {
  AddCircleOutline,
  CheckMd,
  Download,
  HamburgerMenuS,
  MinusCircleOutline,
  MoreH,
  StretchOutExpandH,
  StretchOutExpandV,
} from '@sider/icons'
import { useEventListener, useMemoizedFn } from 'ahooks'
import { Popover, Tooltip } from 'antd'
import { debounce } from 'lodash-es'
import { memo, useMemo, useRef, useState, type FC } from 'react'
import { PDF_ACTION_TOOL_STORAGE_KEY } from '../constants'
import { useDocumentContext } from '../context/DocumentContext'
import { PDFViewerEvent, UIEvents } from '../events'
import { usePDFEvent } from '../hooks/usePDFEvent'
import { SpreadMode } from '../modules/PDFViewer'
import { ScaleMode } from '../utils/ui'
import PageSwitcher from './PageSwitcher'
import TranslatorMenu from './TranslatorMenu'

const ActionTool = memo(function ActionTool() {
  const { eventBus } = useDocumentContext()
  const { t } = useI18n()
  const [actionTool, setActionTool] = useLocalStorageState(
    PDF_ACTION_TOOL_STORAGE_KEY,
    { defaultValue: 'thumbnail', listenStorageChange: true },
  )
  const onActionChange = (action: 'hide-bar' | 'thumbnail' | 'highlight') => {
    setActionTool(action)
    eventBus.emit(UIEvents.ActionChanging, { action })
  }
  const actionTools = useMemo(
    () =>
      [
        { type: 'hide-bar', text: t('pdfViewer.tools.hide-bar') },
        { type: 'thumbnail', text: t('pdfViewer.tools.thumbnail') },
        // { type: 'highlight', text: t('highlight') },
      ] as const,
    [t],
  )
  return (
    <div className="w-[245px] space-y-0.5 p-1.5">
      {actionTools.map((v) => (
        <div
          key={v.type}
          className={cn(
            'flex-between font-semibold-13 w-full cursor-pointer truncate rounded-md p-2.5 transition-colors',
            'text-interactive-label-secondary-default bg-interactive-bg-secondary-default hover:bg-interactive-bg-secondary-hover hover:text-interactive-label-secondary-hover',
          )}
          onClick={() => onActionChange(v.type)}
        >
          {v.text}
          {v.type === actionTool && <CheckMd size={18} />}
        </div>
      ))}
    </div>
  )
})

async function downloadFile(file: string | Blob, name?: string) {
  let url = ''
  let shouldRevoke = false
  if (typeof file === 'string') {
    url = file
  } else {
    shouldRevoke = true
    url = URL.createObjectURL(file)
  }

  const a = document.createElement('a')
  a.href = url
  if (name) {
    a.download = name
  } else if (file instanceof File) {
    a.download = file.name || ''
  }
  a.click()
  shouldRevoke && URL.revokeObjectURL(url)
}

const DownloadMenu = memo(function DownloadMenu() {
  const { t } = useI18n()
  const { file, eventBus, pdfViewer } = useDocumentContext()
  const [open, setOpen] = useState(false)

  const [spreadMode, setSpreadMode] = useState(
    pdfViewer?.spreadMode || SpreadMode.READ,
  )

  usePDFEvent(PDFViewerEvent.SpreadModeChanged, ({ source }) => {
    setSpreadMode(source.spreadMode)
  })

  const handleDownload = () => {
    downloadFile(file)
  }

  const handlePrintTransPDF = () => {
    eventBus.emit(UIEvents.Print)
  }

  if (spreadMode === SpreadMode.READ) {
    return (
      <GPTButton
        variant="text"
        icon={<Download size={20} />}
        onClick={handleDownload}
      />
    )
  }

  return (
    <Popover
      arrow={false}
      placement="bottomRight"
      styles={{
        body: { padding: 0, borderRadius: 20 },
      }}
      open={open}
      onOpenChange={setOpen}
      content={
        <div className="w-[245px] space-y-0.5 p-1.5">
          <div
            className={cn(
              'flex-between font-semibold-13 w-full cursor-pointer truncate rounded-md p-2.5 transition-colors',
              'text-interactive-label-secondary-default bg-interactive-bg-secondary-default hover:bg-interactive-bg-secondary-hover hover:text-interactive-label-secondary-hover',
            )}
            onClick={handleDownload}
          >
            {t('pdfViewer.common.source-file')}
          </div>
          <div
            className={cn(
              'flex-between font-semibold-13 w-full cursor-pointer truncate rounded-md p-2.5 transition-colors',
              'text-interactive-label-secondary-default bg-interactive-bg-secondary-default hover:bg-interactive-bg-secondary-hover hover:text-interactive-label-secondary-hover',
            )}
            onClick={handlePrintTransPDF}
          >
            {t('pdfViewer.common.translated-file')}
          </div>
        </div>
      }
      destroyOnHidden
    >
      <GPTButton variant="text" icon={<Download size={20} />} />
    </Popover>
  )
})

const ZoomControls = memo(function ZoomControls({
  scaleMode,
  updateZoom,
  handleScaleChange,
}: {
  scaleMode: string
  updateZoom: (steps: number) => void
  handleScaleChange: (scale: ScaleMode) => void
}) {
  const { t } = useI18n()
  return (
    <div className="f-i-center gap-2.5">
      <Tooltip title={t('pdfViewer.tools.zoom-in')} arrow={false}>
        <GPTButton
          variant="text"
          disabled={scaleMode === '300%'}
          onClick={() => updateZoom(1)}
          icon={<AddCircleOutline size={20} />}
        />
      </Tooltip>
      <Tooltip title={t('pdfViewer.tools.zoom-out')} arrow={false}>
        <GPTButton
          variant="text"
          onClick={() => updateZoom(-1)}
          icon={<MinusCircleOutline size={20} />}
          disabled={scaleMode === '10%'}
        />
      </Tooltip>
      {scaleMode === ScaleMode.PAGE_HEIGHT && (
        <Tooltip title={t('pdfViewer.tools.fit-width')} arrow={false}>
          <GPTButton
            variant="text"
            onClick={() => handleScaleChange(ScaleMode.PAGE_WIDTH)}
            icon={<StretchOutExpandH size={20} />}
          />
        </Tooltip>
      )}
      {scaleMode === ScaleMode.PAGE_WIDTH && (
        <Tooltip title={t('pdfViewer.tools.fit-height')} arrow={false}>
          <GPTButton
            variant="text"
            onClick={() => handleScaleChange(ScaleMode.PAGE_HEIGHT)}
            icon={<StretchOutExpandV size={20} />}
          />
        </Tooltip>
      )}
    </div>
  )
})

const ControlsMenu = memo(function ControlsMenu({
  scaleMode,
  updateZoom,
  handleScaleChange,
  pageCount,
  currentPageNumber,
  onPageChange,
}: {
  scaleMode: string
  updateZoom: (steps: number) => void
  handleScaleChange: (scale: ScaleMode) => void
  pageCount: number
  currentPageNumber: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="f-i-center gap-2.5">
      <ZoomControls
        scaleMode={scaleMode}
        updateZoom={updateZoom}
        handleScaleChange={handleScaleChange}
      />
      <div className="border-border-default h-4 w-0 shrink-0 border-l" />
      <PageSwitcher
        numPages={pageCount}
        nowPage={currentPageNumber}
        onPageChange={onPageChange}
      />
    </div>
  )
})
interface ToolBarProps {
  backNode: React.ReactNode
  extraNode: React.ReactNode
  onOpenChange?: (open: boolean) => void
}

export const ToolBar: FC<ToolBarProps> = ({
  backNode,
  extraNode,
  onOpenChange,
}) => {
  const { t } = useI18n()
  const toolbarRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const [showInMore, setShowInMore] = useState(false)
  const [showTranslateName, setShowTranslateName] = useState(true)

  const { pdfViewer, globalEnableTranslate } = useDocumentContext()

  // Page and zoom state/handlers remain unchanged...
  const [currentPageNumber, setCurrentPageNumber] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  usePDFEvent(PDFViewerEvent.PagesInit, ({ source }) => {
    setCurrentPageNumber(source.currentPageNumber)
    setPageCount(source.pagesCount)
  })
  usePDFEvent(PDFViewerEvent.PageChanging, ({ source, pageNumber }) => {
    setCurrentPageNumber(pageNumber)
    setPageCount(source.pagesCount)
  })
  const handlePageChange = (pageNumber: number) => {
    pdfViewer?.scrollPageIntoView({ pageNumber })
  }

  /** ---------------------------------- 缩放 ---------------------------------- */
  const [scaleMode, setScaleMode] = useState<
    ScaleMode.PAGE_HEIGHT | ScaleMode.PAGE_WIDTH | string
  >(ScaleMode.PAGE_WIDTH)

  const handleScaleChange = (scale: ScaleMode) => {
    if (!pdfViewer) return
    pdfViewer.currentScaleValue = scale
    setScaleMode(scale)
  }
  const updateZoom = (steps: number) => {
    pdfViewer?.updateScale({ steps, drawingDelay: 100 })
  }

  // 针对不同方向优先级不同的空间检查函数
  const checkSpace = useMemoizedFn(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return

    // 获取中间的弹性间隔元素
    const spacer = toolbar.querySelector('[data-spacer]')
    if (!spacer) return

    // 测量当前弹性间隔的宽度
    const spacerWidth = spacer.getBoundingClientRect().width

    // 设置不同阈值，创建滞后效应
    const COLLAPSE_THRESHOLD = 9 // 需要折叠的阈值
    const EXPAND_THRESHOLD = 30 // 需要展开的阈值（设置更高以防抖动）

    // 获取所有需要测量的元素
    const leftContainer = toolbar.querySelector('[data-left-container]')
    const rightContainer = toolbar.querySelector('[data-right-container]')
    const controlsTemplate = toolbar.querySelector('[data-controls-template]')
    const translatorTemplate = toolbar.querySelector(
      '[data-translator-template]',
    )
    const moreButton = toolbar.querySelector('[data-more-button]')

    if (
      !leftContainer ||
      !rightContainer ||
      !controlsTemplate ||
      (globalEnableTranslate && !translatorTemplate)
    )
      return

    // 获取各元素的宽度
    const controlsWidth = controlsTemplate.getBoundingClientRect().width
    const moreButtonWidth = moreButton?.getBoundingClientRect().width || 0

    // 获取翻译器展开和收起状态的实际宽度差异
    let translatorExpandedWidth = 0
    if (globalEnableTranslate) {
      const fullTranslatorWidth =
        translatorTemplate?.getBoundingClientRect().width || 0
      const currentTranslator = toolbar.querySelector(
        '[data-current-translator]',
      )
      const currentTranslatorWidth =
        currentTranslator?.getBoundingClientRect().width || 0
      translatorExpandedWidth = showTranslateName
        ? 0
        : fullTranslatorWidth - currentTranslatorWidth
    }

    // 计算控件展开需要的额外空间
    const moreExpandedWidth = controlsWidth - moreButtonWidth

    // 检查空间是否不足（需要折叠）
    if (spacerWidth < COLLAPSE_THRESHOLD) {
      // 收起优先级：More > 翻译器名称
      if (!showInMore) {
        // 首先收起控件到More菜单
        setShowInMore(true)
      } else if (showTranslateName && globalEnableTranslate) {
        // 控件已收起，再收起翻译器名称
        setShowTranslateName(false)
      }
    }
    // 检查空间是否充足（可以展开）
    else if (spacerWidth > EXPAND_THRESHOLD) {
      // 展开优先级：翻译器名称 > More
      if (!showTranslateName && globalEnableTranslate) {
        // 首先检查是否可以展开翻译器名称
        // 关键：必须确保展开后空间仍然充足，留出足够缓冲区
        if (spacerWidth - translatorExpandedWidth > EXPAND_THRESHOLD) {
          setShowTranslateName(true)
        }
      } else if (showInMore) {
        // 翻译器名称已展开或不需要展开，检查是否可以展开控件
        if (spacerWidth - moreExpandedWidth > EXPAND_THRESHOLD) {
          setShowInMore(false)
        }
      }
    }
  })

  // 防抖处理函数
  const debouncedCheckSpace = useMemo(() => debounce(checkSpace, 50), [])
  useEventListener('resize', debouncedCheckSpace)

  const openExternal = useOpenExternal()

  const handleDownload = () => {
    // TODO: save to wisebase
    openExternal('https://sider.ai/wisebase')
  }

  const splitLine = (
    <div className="border-border-default h-4 w-0 shrink-0 border-l" />
  )

  return (
    <div className="flex w-full flex-col">
      <div
        ref={toolbarRef}
        className="border-border-default bg-grey-layer1-semitrans2 flex items-center border-b px-3 py-2.5"
      >
        <div data-left-container className="f-i-center gap-2.5">
          {backNode && (
            <>
              {backNode}
              {splitLine}
            </>
          )}
          <Popover
            arrow={false}
            placement="bottomLeft"
            styles={{
              body: { padding: 0, borderRadius: 20 },
            }}
            onOpenChange={onOpenChange}
            content={<ActionTool />}
            destroyOnHidden
          >
            <GPTButton variant="text" icon={<HamburgerMenuS size={20} />} />
          </Popover>

          {/* 分割线 */}
          {splitLine}

          {showInMore ? (
            <Popover
              trigger="hover"
              arrow={false}
              placement="bottom"
              styles={{
                body: { padding: 8, borderRadius: 16 },
              }}
              content={
                <ControlsMenu
                  scaleMode={scaleMode}
                  updateZoom={updateZoom}
                  handleScaleChange={handleScaleChange}
                  pageCount={pageCount}
                  currentPageNumber={currentPageNumber}
                  onPageChange={handlePageChange}
                />
              }
            >
              <div
                data-more-button
                className="text-text-primary-1 hover:bg-grey-fill1-hover cursor-pointer rounded-[8px] p-[8px] transition-colors"
              >
                <MoreH size={16} />
              </div>
            </Popover>
          ) : (
            <div
              ref={controlsRef}
              data-controls
              className="flex items-center gap-2"
            >
              <ZoomControls
                scaleMode={scaleMode}
                updateZoom={updateZoom}
                handleScaleChange={handleScaleChange}
              />
              <div className="bg-text-primary-5 mx-[7px] h-[16px] w-[1px] shrink-0"></div>
              <PageSwitcher
                numPages={pageCount}
                nowPage={currentPageNumber}
                onPageChange={handlePageChange}
              />
            </div>
          )}
          {globalEnableTranslate && (
            <>
              {!showInMore && (
                <div className="bg-text-primary-5 mx-[7px] h-[16px] w-[1px] shrink-0"></div>
              )}
              <div data-current-translator className="shrink-0">
                <TranslatorMenu showTranslateName={showTranslateName} />
              </div>
            </>
          )}

          {/* 用于精确测量的隐藏元素 */}
          <div
            data-controls-template
            className="pointer-events-none absolute opacity-0"
          >
            <div className="flex items-center gap-2">
              <ZoomControls
                scaleMode={scaleMode}
                updateZoom={updateZoom}
                handleScaleChange={handleScaleChange}
              />
              <div className="bg-text-primary-5 mx-[7px] h-[16px] w-[1px] shrink-0"></div>
              <PageSwitcher
                numPages={pageCount}
                nowPage={currentPageNumber}
                onPageChange={handlePageChange}
              />
            </div>
          </div>

          {/* 添加隐藏的翻译器模板用于宽度计算 */}
          {globalEnableTranslate && (
            <div
              data-translator-template
              className="pointer-events-none absolute opacity-0"
            >
              <TranslatorMenu showTranslateName={true} />
            </div>
          )}
        </div>
        <div className="ms-auto">
          <Tooltip
            title={t('pdfViewer.common.open-sider-and-download')}
            arrow={false}
          >
            <GPTButton
              variant="text"
              icon={<Download size={20} />}
              onClick={handleDownload}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
