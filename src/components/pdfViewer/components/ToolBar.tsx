import { cn } from '@/utils/cn'
import { useLocalStorageState } from '@sider/hooks'
import {
  AddCircleOutline,
  ArrowOutlineMB,
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
import { useTranslation } from 'react-i18next'
import { PDF_ACTION_TOOL_STORAGE_KEY } from '../constants'
import { useDocumentContext } from '../context/DocumentContext'
import { PDFViewerEvent, UIEvents } from '../events'
import { usePDFEvent } from '../hooks/usePDFEvent'
import { ScaleMode } from '../utils/ui'
import PageSwitcher from './PageSwitcher'
import TranslatorMenu from './TranslatorMenu'

const ActionTool = memo(function ActionTool() {
  const { eventBus } = useDocumentContext()
  const { t } = useTranslation('pdfViewer.tools')
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
        { type: 'hide-bar', text: t('hide-bar') },
        { type: 'thumbnail', text: t('thumbnail') },
        { type: 'highlight', text: t('highlight') },
      ] as const,
    [t],
  )
  return (
    <div className="flex w-[164px] flex-col gap-[2px]">
      {actionTools.map((v) => (
        <div
          key={v.type}
          className={cn(
            'text-color-text-primary-1 font-normal-14 hover:bg-color-grey-fill1-hover line-clamp-1 flex cursor-pointer rounded-[8px] px-[9px] py-[6px] transition-colors',
            { '!bg-color-brand-primary-focus': v.type === actionTool },
          )}
          onClick={() => onActionChange(v.type)}
        >
          {v.text}
        </div>
      ))}
    </div>
  )
})

const ZoomControls = memo(function ZoomControls({
  scaleMode,
  updateZoom,
  handleScaleChange,
  t,
}: {
  scaleMode: string
  updateZoom: (steps: number) => void
  handleScaleChange: (scale: ScaleMode) => void
  t: (key: string) => string
}) {
  return (
    <div className="flex">
      <Tooltip title={t('zoom-in')}>
        <div
          onClick={() => updateZoom(1)}
          className={cn(
            'rounded-[8px] p-[8px] transition-colors',
            scaleMode === '300%'
              ? 'bg-color-grey-fill1-normal text-color-text-primary-5 cursor-not-allowed'
              : 'text-color-text-primary-1 hover:bg-color-grey-fill1-hover cursor-pointer',
          )}
        >
          <AddCircleOutline size={16} />
        </div>
      </Tooltip>
      <Tooltip title={t('zoom-out')}>
        <div
          onClick={() => updateZoom(-1)}
          className={cn(
            'rounded-[8px] p-[8px] transition-colors',
            scaleMode === '10%'
              ? 'bg-color-grey-fill1-normal text-color-text-primary-5 cursor-not-allowed'
              : 'text-color-text-primary-1 hover:bg-color-grey-fill1-hover cursor-pointer',
          )}
        >
          <MinusCircleOutline size={16} />
        </div>
      </Tooltip>
      {scaleMode === ScaleMode.PAGE_HEIGHT && (
        <Tooltip title={t('fit-width')}>
          <div
            onClick={() => handleScaleChange(ScaleMode.PAGE_WIDTH)}
            className="hover:bg-color-grey-fill1-hover cursor-pointer rounded-[8px] p-[8px] transition-colors"
          >
            <span className="text-color-text-primary-1">
              <StretchOutExpandH size={16} />
            </span>
          </div>
        </Tooltip>
      )}
      {scaleMode === ScaleMode.PAGE_WIDTH && (
        <Tooltip title={t('fit-height')}>
          <div
            onClick={() => handleScaleChange(ScaleMode.PAGE_HEIGHT)}
            className="hover:bg-color-grey-fill1-hover cursor-pointer rounded-[8px] p-[8px] transition-colors"
          >
            <span className="text-color-text-primary-1">
              <StretchOutExpandV size={16} />
            </span>
          </div>
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
  t,
}: {
  scaleMode: string
  updateZoom: (steps: number) => void
  handleScaleChange: (scale: ScaleMode) => void
  pageCount: number
  currentPageNumber: number
  onPageChange: (page: number) => void
  t: (key: string) => string
}) {
  return (
    <div className="flex min-w-[200px] items-center gap-2">
      <ZoomControls
        scaleMode={scaleMode}
        updateZoom={updateZoom}
        handleScaleChange={handleScaleChange}
        t={t}
      />
      <div className="bg-color-text-primary-5 mx-[7px] h-[16px] w-[1px] shrink-0"></div>
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
  const { t } = useTranslation('pdfViewer.tools')
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

  return (
    <div className="flex w-full flex-col">
      <div
        ref={toolbarRef}
        className="bg-color-grey-layer1-semitrans2 flex items-center px-[20px] py-[12px]"
      >
        <div data-left-container className="flex items-center gap-[8px]">
          {backNode && (
            <>
              {backNode}
              <div className="bg-color-text-primary-5 mx-[7px] h-[16px] w-[1px] shrink-0"></div>
            </>
          )}
          <Popover
            trigger="hover"
            arrow={false}
            placement="bottomLeft"
            overlayInnerStyle={{
              padding: 8,
              borderRadius: 16,
              background: 'var(--color-grey-layer3-normal)',
            }}
            onOpenChange={onOpenChange}
            content={<ActionTool />}
            destroyTooltipOnHide
          >
            <div className="f-i-center hover:bg-color-grey-fill1-hover shrink-0 cursor-pointer gap-[8px] rounded-[8px] p-[8px] transition-colors">
              <span className="text-color-text-primary-1">
                <HamburgerMenuS size={16} />
              </span>
              <span className="text-color-text-primary-1">
                <ArrowOutlineMB size={12} />
              </span>
            </div>
          </Popover>
          <div
            data-menu-divider
            className="bg-color-text-primary-5 mx-[7px] h-[16px] w-[1px] shrink-0"
          ></div>

          {showInMore ? (
            <Popover
              trigger="hover"
              arrow={false}
              placement="bottom"
              overlayInnerStyle={{
                padding: 8,
                borderRadius: 16,
                background: 'var(--color-grey-layer3-normal)',
              }}
              content={
                <ControlsMenu
                  scaleMode={scaleMode}
                  updateZoom={updateZoom}
                  handleScaleChange={handleScaleChange}
                  pageCount={pageCount}
                  currentPageNumber={currentPageNumber}
                  onPageChange={handlePageChange}
                  t={t}
                />
              }
            >
              <div
                data-more-button
                className="text-color-text-primary-1 hover:bg-color-grey-fill1-hover cursor-pointer rounded-[8px] p-[8px] transition-colors"
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
                t={t}
              />
              <div className="bg-color-text-primary-5 mx-[7px] h-[16px] w-[1px] shrink-0"></div>
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
                <div className="bg-color-text-primary-5 mx-[7px] h-[16px] w-[1px] shrink-0"></div>
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
                t={t}
              />
              <div className="bg-color-text-primary-5 mx-[7px] h-[16px] w-[1px] shrink-0"></div>
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
        <div data-spacer className="min-w-2 flex-1"></div>
        <div data-right-container className="flex items-center gap-[8px]">
          <div className="flex shrink-0">{extraNode}</div>
        </div>
      </div>
      <div className="border-color-grey-line1-normal shrink-0 border-b"></div>
    </div>
  )
}
