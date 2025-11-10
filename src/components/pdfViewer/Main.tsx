import { cn } from '@/utils/cn'
import { Mitter } from '@/utils/mitter'
import { useLatest, useMemoizedFn, useUnmount } from 'ahooks'
import { getPdfFilenameFromUrl, type PDFDocumentProxy } from 'pdfjs-dist'
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  type ForwardRefRenderFunction,
} from 'react'
import Document, { type DocumentOptions } from './Document'
import loadingIcon from './assets/loading.svg?url'
import RightFillIcon from './assets/right-fill.svg?url'
import { PrintService } from './components/PrintService'
import { SCROLL_CONTAINER_ID } from './constants'
import { DocumentContext } from './context/DocumentContext'
import {
  FindEvent,
  UIEvents,
  type FindTextPayload,
  type PDFEventBus,
} from './events'
import { type TextToHighlight } from './modules/AnnotationEditorUIManager'
import { LinkService } from './modules/LinkService'
import { PDFFindController } from './modules/PDFFindController'
import { PDFRenderingQueue } from './modules/PDFRenderingQueue'
import { PDFViewer, SpreadMode } from './modules/PDFViewer'
import { Highlight, type HighlightSerialized } from './modules/highlight'
import {
  OCRService,
  TranslationService,
  TranslationStorageService,
  type TranslateOption,
} from './services/TranslationService'
import {
  TranslationServiceManager,
  type TranslateServiceInfoDefault,
} from './services/TranslationServiceManager'

import './index.css'

export type PDFForwardRef = {
  getSpreadMode: () => SpreadMode
  getPDFMeta: () => {
    pageCount: number
  }
  findTextHighlight: (
    options: Pick<FindTextPayload, 'query' | 'pageNumber'>,
  ) => void
  findTextClose: () => void
  highlightSelection: (options: {
    // 默认读取 window.getSelection()
    selection?: Selection
    color?: string
    hoverColor?: string
    // 是否清空选中状态 默认为 true
    clearSelection?: boolean
  }) => Highlight | null
  // 高亮回显
  highlightsSerialized: (datas: HighlightSerialized[]) => void
  // 文本转高亮
  textToHighlights: (datas: TextToHighlight[]) => void
  // 移除高亮
  removeHighlight: (highlight: Highlight) => void
  // 打印翻译pdf
  printTransPDF: () => void
  // 更新高亮
  updateHighlight: (id: string, options: any) => void
}

interface MainProps extends DocumentOptions {
  className?: string
  fileName?: string
  toolBar?: React.ReactNode
  siderBar?: React.ReactNode
  enableFind?: boolean
  globalEnableTranslate?: boolean
  ocrService?: OCRService
  translationStorageService: TranslationStorageService
  defaultTranslateServerInfo?: TranslateServiceInfoDefault
  translateServices?: TranslationService[]

  /**
   * 监听点击全局翻译模型列表 业务需求
   * @returns true 继续执行，false 停止执行后续操作
   */
  onGlobalModelChange?: (model: TranslateOption) => boolean | Promise<boolean>
}

const Main: ForwardRefRenderFunction<PDFForwardRef, MainProps> = (
  {
    className,
    toolBar,
    siderBar,
    file,
    fileName,
    version = '1.0.0',
    translateServices = [],
    defaultTranslateServerInfo,
    globalEnableTranslate = true,
    ocrService,
    translationStorageService,
    spreadMode = SpreadMode.READ,
    onGlobalModelChange: onGlobalModelChangeProp,
    ...props
  },
  ref,
) => {
  const [eventBus] = useState<PDFEventBus>(() => new Mitter())
  const [translationService] = useState(
    () =>
      new TranslationServiceManager({
        spreadMode,
        ocrService,
        translateServices,
        translationStorageService,
        globalEnableTranslate,
        version,
        defaultTranslateServerInfo,
        eventBus,
      }),
  )
  const [linkService] = useState(() => {
    return new LinkService({
      translationService,
      eventBus,
      externalLinkTarget: '_blank',
    })
  })
  const [renderingQueue] = useState(() => new PDFRenderingQueue())

  const [pdfDocument, setPDFDocument] = useState<PDFDocumentProxy | null>(null)
  const [pdfViewer, setPDFViewer] = useState<PDFViewer | null>(null)
  const [pdfFindController, setPDFFindController] =
    useState<PDFFindController | null>(null)

  const pdfViewerRef = useLatest(pdfViewer)

  useUnmount(() => {
    pdfViewerRef.current?.setDocument(null)
  })

  useImperativeHandle(ref, () => ({
    getSpreadMode: () => {
      return pdfViewerRef.current?.spreadMode || SpreadMode.READ
    },
    getPDFMeta: () => {
      return {
        pageCount: linkService.pagesCount,
      }
    },
    findTextHighlight: (options) => {
      eventBus.emit(FindEvent.FindText, {
        ...options,
        highlightAll: true,
        parallel: true,
      })
    },
    findTextClose: () => {
      eventBus.emit(FindEvent.CloseFind)
    },
    highlightSelection: (options) => {
      if (!pdfViewerRef.current) return null
      return pdfViewerRef.current.uiManager?.highlightSelection(options) || null
    },
    textToHighlights(datas) {
      if (!pdfViewerRef.current) return
      pdfViewerRef.current.uiManager?.textToHighlights(datas)
    },
    highlightsSerialized(datas: HighlightSerialized[]) {
      if (!pdfViewerRef.current) return
      pdfViewerRef.current.uiManager?.highlightsSerialized(datas)
    },
    removeHighlight: (highlight: Highlight) => {
      if (!pdfViewerRef.current) return
      highlight.remove()
    },
    printTransPDF: () => {
      eventBus.emit(UIEvents.Print)
    },
    updateHighlight: (id: string, options: any) => {
      if (!pdfViewerRef.current) return
      pdfViewerRef.current.uiManager?.updateHighlight(id, options)
    },
  }))

  const docFileName = useMemo(() => {
    return fileName || getPdfFilenameFromUrl(file)
  }, [fileName, file])

  const onGlobalModelChange = useMemoizedFn((model: TranslateOption) => {
    const fn = onGlobalModelChangeProp || (() => true)
    return Promise.resolve(fn(model))
  })

  const childrenContext = useMemo(
    () => ({
      version,
      file,
      pdfDocument,
      spreadMode,
      pdfViewer,
      pdfFindController,
      translationService,
      linkService,
      eventBus,
      renderingQueue,
      globalEnableTranslate,
      docFileName,
      onGlobalModelChange,
    }),
    [
      file,
      pdfDocument,
      spreadMode,
      pdfViewer,
      pdfFindController,
      translationService,
      linkService,
      eventBus,
      renderingQueue,
      globalEnableTranslate,
      version,
      docFileName,
      onGlobalModelChange,
    ],
  )

  return (
    <div
      id={SCROLL_CONTAINER_ID}
      data-ext-context-menu="no"
      data-ext-inject="no"
      className={cn(
        'bg-grey-layer1-semitrans h-full w-full contain-layout',
        className,
      )}
      style={
        {
          '--loading-icon': `url("${loadingIcon.src}")`,
          '--success-right-icon': `url("${RightFillIcon.src}")`,
        } as React.CSSProperties
      }
    >
      <DocumentContext.Provider value={childrenContext}>
        <div className="flex size-full flex-col">
          <div className="shrink-0">{toolBar}</div>
          <div className="flex h-0 flex-1">
            <div className="shrink-0">{siderBar}</div>
            <Document
              {...props}
              file={file}
              version={version}
              spreadMode={spreadMode}
              setPDFDocument={setPDFDocument}
              setPDFViewer={setPDFViewer}
              setPDFFindController={setPDFFindController}
            />
          </div>
        </div>
        <PrintService />
      </DocumentContext.Provider>
    </div>
  )
}

export default forwardRef(Main)
