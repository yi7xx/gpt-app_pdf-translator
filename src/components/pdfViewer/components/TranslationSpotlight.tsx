/* eslint-disable max-lines */
import useI18n from '@/hooks/useI18n'
import { cn } from '@/utils/cn'
import {
  ArrowOutlineLB,
  CloseOutlineS,
  Copy,
  Edit2,
  RightOutlineS,
} from '@sider/icons'
import { useEventListener, useKeyPress, usePrevious } from 'ahooks'
import { Popover, Tooltip, message } from 'antd'
import { throttle } from 'lodash-es'
import { Easing, motion } from 'motion/react'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FC,
} from 'react'
import { useDocumentContext } from '../context/DocumentContext'
import {
  PDFTransViewerEvents,
  PDFViewerEvent,
  TransServerEvents,
} from '../events'
import { usePDFEvent } from '../hooks/usePDFEvent'
import { PDFTransEditorItem } from '../modules/PDFTransEditorItem'
import { PDFTransPageView } from '../modules/PDFTransPageView'
import { type PDFViewer } from '../modules/PDFViewer'
import { type TranslateOption } from '../services/TranslationService'
import ModelList from './ModelList'

type RenderBox = readonly [number, number, number, number]

// 边距
const PADDING = 4
// 延时清空
const CLEAR_TIMEOUT = 250

const DEFAULT_BOX = [0, 0, 0, 0]

const getTransition = (shouldAnimate: boolean) => {
  const defaultTransition = {
    type: 'spring',
    stiffness: 800,
    damping: 30,
    mass: 0.3,
  }
  const noAnimation = { duration: 0 }

  return {
    opacity: { duration: 0.15, ease: 'easeInOut' as Easing },
    ...['x', 'y', 'width', 'height'].reduce(
      (acc, key) => {
        acc[key] = shouldAnimate ? noAnimation : defaultTransition
        return acc
      },
      {} as Record<string, any>,
    ),
  }
}

const useRenderBox = (box: RenderBox | null) => {
  const lastBox = usePrevious(box)

  const {
    box: [x, y, width, height],
    opacity,
    display,
  } = useMemo(() => {
    if (lastBox == null && box === null) {
      return { box: DEFAULT_BOX, opacity: 0, display: 'none' }
    }
    // 说明为第一次进入
    if (lastBox == null) {
      return { box: box || DEFAULT_BOX, opacity: 1 }
    }
    // 说明是退出
    if (box === null) {
      return { box: lastBox, opacity: 0, display: 'none' }
    }
    return { box, opacity: 1 }
  }, [box])

  const shouldAnimate = lastBox === null || box === null

  const transition = useMemo(
    () => getTransition(shouldAnimate),
    [shouldAnimate],
  )

  return {
    box: [x, y, width, height],
    opacity,
    display,
    transition,
  }
}

const RenderPage: FC<{ box: RenderBox | null }> = ({ box }) => {
  const {
    box: [x, y, width, height],
    opacity,
    display,
    transition,
  } = useRenderBox(box)
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{
        opacity,
        x,
        y,
        width,
        height,
        display,
      }}
      transition={transition}
      className="bg-assistive-blue-focus absolute z-[999] rounded-[6px]"
    />
  )
}

const RenderTransPages: FC<{
  box: RenderBox | null
  editorItem: PDFTransEditorItem | null
  // 是否启用tools
  enabledTools?: boolean
  onCancel: () => void
  onEnableChange: (hover: boolean) => void
}> = ({ box, editorItem, enabledTools = true, onEnableChange, onCancel }) => {
  const { t } = useI18n()
  const { translationService, pdfViewer, eventBus } = useDocumentContext()
  const toolsRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  const updateEditorItemState = (state: {
    id: string
    text?: string
    model?: string
    syncStorage?: boolean
  }) => {
    eventBus.emit(TransServerEvents.UPDATE_EDITOR_ITEM_STATE, state)
  }

  const {
    box: [x, y, width, height],
    opacity,
    display,
    transition,
  } = useRenderBox(box)

  const [modelOption, setModelOption] = useState(
    translationService.defaultModelOption,
  )

  const findModelOption = (model?: string) => {
    return (
      translationService.options.find((option) => option.name === model) ||
      translationService.defaultModelOption
    )
  }

  useEffect(() => {
    if (editorItem) {
      setModelOption(findModelOption(editorItem.model))
    }
  }, [editorItem])

  const handleModelChange = (option: TranslateOption) => {
    if (editorItem) {
      updateEditorItemState({
        id: editorItem.id,
        model: option.name,
      })
    }
    setOpen(false)
  }

  const handleToolsHover = (hover: boolean) => {
    if (open || editing) {
      hover = true
    }
    onEnableChange(!hover)
  }

  const handleCopy = () => {
    const text = editorItem?.text
    if (!text) {
      return
    }
    navigator.clipboard.writeText(text)
    message.success({
      key: editorItem.id,
      content: t('pdfViewer.tools.copy-success'),
    })
  }

  const [editingText, setEditingText] = useState(editorItem?.text)
  const [editing, setEditing] = useState(false)
  const [editingStyle, setEditingStyle] = useState<CSSProperties>({})
  const editorRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<NodeJS.Timeout | null>(null)
  const handleEdit = (e: React.MouseEvent) => {
    if (open) {
      setOpen(false)
    }
    e.stopPropagation()
    setEditing(true)
    setEditingText(editorItem?.text)
    setEditingStyle(editorItem?.style || {})
    setTimeout(() => {
      if (textareaRef.current) {
        const { value, scrollHeight } = textareaRef.current
        textareaRef.current.selectionStart = value.length
        textareaRef.current.selectionEnd = value.length
        textareaRef.current.scrollTop = scrollHeight
        textareaRef.current.focus()
      }
    })
  }

  const handleSave = () => {
    if (!editorItem) {
      return
    }
    if (editorItem.text !== editingText) {
      updateEditorItemState({
        id: editorItem.id,
        text: editingText,
        syncStorage: true,
      })
    }
    setEditing(false)
  }

  useKeyPress(
    'enter',
    (e) => {
      e.stopPropagation()
      handleSave()
    },
    { target: editorRef, exactMatch: true },
  )

  useEffect(() => {
    if (open || editing) {
      onEnableChange(false)
      return
    }
    if (!open && !editing) {
      onEnableChange(true)
    }
  }, [open, editing])

  const onClickAway = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    const isChangeEditItem =
      target.classList.contains('.pdfTransEditorItemText') ||
      !!target.closest('.pdfTransEditorItemText')
    setOpen(false)
    if (editing && !isChangeEditItem) {
      timer.current = setTimeout(() => {
        setEditing(false)
        timer.current = null
      }, 150)
    } else {
      setEditing(false)
    }
    onCancel()
  }

  // useClickAway 监听只能监听一个dom，多个dom失效了，没仔细深究，暂时用事件监听代替
  useEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement
    if (!toolsRef.current) {
      return
    }
    const tools = toolsRef.current
    const editor = editorRef.current
    if (target === tools || tools.contains(target)) {
      return
    }
    if (editor && (editor === target || editor.contains(target))) {
      return
    }
    onClickAway(e)
  })

  const [isTranslating, setIsTranslating] = useState(false)
  const checkTranslationStatus = useCallback(() => {
    if (!editorItem || !pdfViewer?.transUIManager) return false
    return pdfViewer.transUIManager.isEditorItemTranslating(editorItem.id)
  }, [editorItem, pdfViewer])

  useEffect(() => {
    setIsTranslating(checkTranslationStatus())
  }, [editorItem, checkTranslationStatus])

  usePDFEvent(
    [
      PDFTransViewerEvents.TranslatePageRequestAdded,
      PDFTransViewerEvents.TranslatePageRequestRemoved,
    ],
    ({ id }) => {
      if (editorItem && id === editorItem.id) {
        setIsTranslating(checkTranslationStatus())
        setModelOption(findModelOption(editorItem.model))
      }
    },
  )

  // 解决 icon defs id重复，组件被display：none，导致其他icon不显示的问题
  const [renderIcon, setRenderIcon] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{
        opacity,
        x,
        y,
        width,
        height,
        display,
      }}
      onAnimationStart={() => setRenderIcon(false)}
      onAnimationComplete={() => setRenderIcon(display === 'none')}
      transition={transition}
      className={cn(
        'rounded-[6px]',
        editing
          ? 'border-brand-primary-normal bg-grey-layer2-normal border'
          : 'bg-assistive-blue-focus',
      )}
      style={{
        boxShadow: editing ? '0px 0px 0px 3px var(--focus-primary-1)' : 'none',
      }}
      onPointerMove={() => handleToolsHover(true)}
      onPointerLeave={() => handleToolsHover(false)}
    >
      {enabledTools && (
        <>
          {editing && !isTranslating && (
            <div
              ref={editorRef}
              className="flex-center pointer-events-auto absolute -top-[1px] -left-[1px] p-[4px]"
              style={{
                width,
                height,
              }}
            >
              <textarea
                ref={textareaRef}
                className="custom-scrollbar bg-grey-layer2-normal text-text-primary-2 size-full resize-none border-none p-0 outline-none"
                value={editingText}
                style={editingStyle}
                onChange={(e) => setEditingText(e.target.value)}
              />
            </div>
          )}
          {isTranslating || (
            <div
              ref={toolsRef}
              className="pointer-events-auto absolute right-0 bottom-[1px] translate-y-full"
            >
              {editing ? (
                <div className="f-i-center mt-[6px] gap-[6px]">
                  <button
                    onClick={() => setEditing(false)}
                    className="bg-glass-fill2-normal text-text-secondary-1 hover:bg-glass-fill2-hover rounded-[6px] p-[6px] backdrop-blur-[13px] transition-colors"
                  >
                    <CloseOutlineS size={14} />
                  </button>
                  <button
                    onClick={handleSave}
                    className="hover:bg-advanced-fil-hover bg-advanced-fill-normal text-text-secondary-1 rounded-[6px] p-[6px] transition-colors"
                  >
                    <RightOutlineS size={14} />
                  </button>
                </div>
              ) : (
                <div
                  className="border-grey-line1-normal f-i-center -mr-[14px] gap-[4px] rounded-[12px] border bg-white p-[4px]"
                  style={{
                    boxShadow:
                      '0px 0px 0px 1px rgba(255, 255, 255, 0.12), 0px 2px 8px -4px rgba(12, 13, 25, 0.12), 0px 4px 16px 0px rgba(12, 13, 25, 0.08), 0px 8px 32px 8px rgba(12, 13, 25, 0.04)',
                  }}
                >
                  <Popover
                    placement="bottom"
                    arrow={false}
                    trigger="click"
                    open={open}
                    align={{ offset: [0, 6] }}
                    styles={{
                      body: {
                        width: 200,
                        padding: 0,
                        borderRadius: 16,
                        background: 'var(--grey-layer3-normal)',
                        boxShadow:
                          '0px 6px 24px 0px rgba(12, 13, 25, 0.04), 0px 12px 48px 0px rgba(12, 13, 25, 0.04), 0px 24px 96px 0px rgba(12, 13, 25, 0.04)',
                      },
                    }}
                    getPopupContainer={() => toolsRef.current!}
                    destroyOnHidden
                    content={
                      <div className="size-full p-[8px]">
                        <ModelList
                          isGlobalTranslation={false}
                          activeModel={modelOption.name}
                          onChange={handleModelChange}
                        />
                      </div>
                    }
                  >
                    <div
                      onClick={() => setOpen((pre) => !pre)}
                      className="f-i-center hover:bg-grey-fill2-normal cursor-pointer gap-[8px] rounded-[8px] py-[8px] pr-[6px] pl-[8px] transition-colors"
                    >
                      <div className="flex-center size-[16px] shrink-0 text-[14px]">
                        {renderIcon ? null : modelOption.icon}
                      </div>
                      <span className="text-text-primary-3">
                        <ArrowOutlineLB size={8} />
                      </span>
                    </div>
                  </Popover>
                  <div className="bg-grey-line2-normal mx-[6px] h-[14px] w-[1px] shrink-0 rounded-full"></div>
                  <Tooltip title={t('pdfViewer.tools.copy')}>
                    <div
                      onClick={handleCopy}
                      className="text-text-primary-1 hover:bg-grey-fill1-hover cursor-pointer rounded-[8px] p-[8px]"
                    >
                      <Copy size={16} />
                    </div>
                  </Tooltip>
                  <Tooltip title={t('pdfViewer.tools.edit')}>
                    <div
                      onClickCapture={handleEdit}
                      className="text-text-primary-1 hover:bg-grey-fill1-hover cursor-pointer rounded-[8px] p-[8px]"
                    >
                      <Edit2 size={16} />
                    </div>
                  </Tooltip>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}

interface OffsetMap {
  viewerOffset: { x: number; y: number }
  transOffset: { x: number; y: number; rotate: number }
  pageViewOffset: { x: number; y: number; rotate: number }
}

const TranslationSpotlight = () => {
  const { pdfViewer } = useDocumentContext()
  const [pageBox, setPageBox] = useState<RenderBox | null>(null)
  const [transBox, setTransBox] = useState<RenderBox | null>(null)
  const [enabledTools, setEnabledTools] = useState(true)
  const timer = useRef<NodeJS.Timeout | null>(null)
  const enableChangeRef = useRef(true)
  // 记录坐标 减少dom计算
  const offsetMapRef = useRef<Map<number, OffsetMap>>(new Map())
  usePDFEvent(
    [PDFViewerEvent.ScaleChanging, PDFViewerEvent.PagesDestroy],
    () => {
      offsetMapRef.current.clear()
    },
  )
  const getPageOffset = (pdfViewer: PDFViewer, id: number) => {
    const offsetMap = offsetMapRef.current.get(id)
    if (offsetMap) {
      return offsetMap
    }
    const { offsetLeft = 0, offsetTop = 0 } =
      pdfViewer.getTransPageView(id)?.div || {}
    const {
      offsetLeft: pageViewOffsetLeft = 0,
      offsetTop: pageViewOffsetTop = 0,
    } = pdfViewer.getPageView(id)?.div || {}
    const viewerOffsetLeft = pdfViewer.viewer.offsetLeft ?? 0
    const viewerOffsetTop = pdfViewer.viewer.offsetTop ?? 0
    const offset = {
      viewerOffset: { x: viewerOffsetLeft, y: viewerOffsetTop },
      transOffset: { x: offsetLeft, y: offsetTop, rotate: 0 },
      pageViewOffset: {
        x: pageViewOffsetLeft,
        y: pageViewOffsetTop,
        rotate: 0,
      },
    }
    offsetMapRef.current.set(id, offset)
    return offset
  }

  const calculateBox = (
    box: RenderBox,
    offset: { x: number; y: number; rotate: number },
  ): RenderBox => {
    const [x, y, width, height] = box
    const [newX, newY, newWidth, newHeight] = [
      x + offset.x - PADDING,
      y + offset.y - PADDING,
      width + PADDING * 2,
      height + PADDING * 2,
    ]
    switch (offset.rotate) {
      case 90:
        return [newX, newY, newHeight, newWidth]
      case 270:
        return [newX, newY - newWidth + newHeight, newHeight, newWidth]
      default:
        return [newX, newY, newWidth, newHeight]
    }
  }

  const currentTransPageView = useRef<PDFTransPageView | null>(null)
  const currentEditorItem = useRef<PDFTransEditorItem | null>(null)
  // 记录最新的trans
  const cacheLastTrans = useRef<{
    transPageView: PDFTransPageView | null
    editorItem: PDFTransEditorItem | null
  }>({
    transPageView: null,
    editorItem: null,
  })

  const setCurrentEditor = (
    transPageView: PDFTransPageView | null,
    editorItem: PDFTransEditorItem | null,
  ) => {
    if (currentEditorItem.current) {
      currentEditorItem.current.setActive(false)
    }
    if (editorItem) {
      editorItem.setActive(true)
    }
    currentEditorItem.current = editorItem
    currentTransPageView.current = transPageView
  }

  const clearBox = () => {
    setPageBox(null)
    setTransBox(null)
    setCurrentEditor(null, null)
  }

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  const createClearTimer = () => {
    timer.current = setTimeout(() => {
      timer.current = null
      if (enableChangeRef.current) {
        clearBox()
      }
    }, CLEAR_TIMEOUT)
  }

  const onPageSpotlight = useCallback(
    (
      transPageView: PDFTransPageView | null,
      editorItem: PDFTransEditorItem | null,
      from: 'pdf' | 'pdfTrans' = 'pdfTrans',
    ) => {
      cacheLastTrans.current = { transPageView, editorItem }

      setEnabledTools(from === 'pdfTrans')

      if (!enableChangeRef.current) {
        clearTimer()
        return
      }

      // 离开翻译页面直接清除
      if (transPageView === null) {
        createClearTimer()
        return
      }

      clearTimer()
      // 当前翻译页面和当前翻译item相同，不处理
      if (editorItem && currentEditorItem.current === editorItem) {
        return
      }
      if (editorItem === null || !pdfViewer) {
        createClearTimer()
        return
      }
      setCurrentEditor(transPageView, editorItem)
      const { transOffset, pageViewOffset, viewerOffset } = getPageOffset(
        pdfViewer,
        transPageView.id,
      )
      const scrollXDom = pdfViewer.viewer.parentElement as HTMLElement
      const scrollLeft = scrollXDom.scrollLeft ?? 0
      const rotate = editorItem.rotate
      setPageBox(
        calculateBox(editorItem.rawRect, {
          x: pageViewOffset.x + viewerOffset.x - scrollLeft,
          y: pageViewOffset.y + viewerOffset.y,
          rotate,
        }),
      )
      setTransBox(
        calculateBox(editorItem.rectBox, {
          x: transOffset.x + viewerOffset.x - scrollLeft,
          y: transOffset.y + viewerOffset.y,
          rotate,
        }),
      )
    },
    [pdfViewer],
  )

  const throttlePageSpotlight = useMemo(
    () => throttle(onPageSpotlight, 25),
    [onPageSpotlight],
  )
  usePDFEvent(
    PDFTransViewerEvents.PageSpotlight,
    ({ editorItem, from, source }) => {
      throttlePageSpotlight(source, editorItem, from)
    },
  )
  usePDFEvent(
    [
      PDFViewerEvent.PagesDestroy,
      PDFViewerEvent.ScaleChanging,
      PDFViewerEvent.ScrollX,
    ],
    () => {
      enableChangeRef.current = true
      clearBox()
    },
  )
  usePDFEvent(PDFTransViewerEvents.TranslatePageRequestRemoved, ({ id }) => {
    const { transPageView, editorItem } = cacheLastTrans.current
    if (editorItem?.id === id) {
      onPageSpotlight(transPageView, editorItem)
    }
  })

  return (
    <div className="pointer-events-none absolute top-0 left-0 size-0">
      {pdfViewer && pdfViewer.isCompareMode && <RenderPage box={pageBox} />}
      <RenderTransPages
        enabledTools={false}
        box={transBox}
        editorItem={currentEditorItem.current}
        onCancel={() => {
          enableChangeRef.current = true
          const { transPageView, editorItem } = cacheLastTrans.current
          onPageSpotlight(editorItem ? transPageView : null, editorItem)
        }}
        onEnableChange={(val) => {
          enableChangeRef.current = val
        }}
      />
    </div>
  )
}

export default memo(TranslationSpotlight)
