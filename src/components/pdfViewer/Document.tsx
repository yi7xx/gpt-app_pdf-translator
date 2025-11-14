import { baseURL } from '@/baseUrl'
import useI18n from '@/hooks/useI18n'
import { ExclamationMarkCircleFilledError, Loading } from '@sider/icons'
import { useAsyncEffect, useMemoizedFn } from 'ahooks'
import { debounce } from 'lodash-es'
import { type PDFDocumentLoadingTask, type PDFDocumentProxy } from 'pdfjs-dist'
import { memo, useEffect, useMemo, useRef, useState, type FC } from 'react'
import TranslationSpotlight from './components/TranslationSpotlight'
import { VERTICAL_PADDING } from './constants'
import { useDocumentContext } from './context/DocumentContext'
import { PDFViewerEvent } from './events'
import { useBindEvent } from './hooks/useBindEvent'
import { usePDFEvent } from './hooks/usePDFEvent'
import { useWatchScroll } from './hooks/useWatchScroll'
import pdfjsLib from './libs/pdf'
import type { TextToHighlight } from './modules/AnnotationEditorUIManager'
import { PDFFindController } from './modules/PDFFindController'
import { PDFViewer, SpreadMode } from './modules/PDFViewer'
import type { Highlight } from './modules/highlight'
import type { TranslateServiceInfo } from './services/TranslationServiceManager'
import { ScaleMode } from './utils/ui'

export interface DocumentOptions {
  file: string
  version?: string
  children?: React.ReactNode
  cMapUrl?: string
  standardFontDataUrl?: string
  defaultPageNumber?: number
  defaultScale?: ScaleMode | number
  enableFind?: boolean
  // 默认扩展模式
  spreadMode?: SpreadMode
  onSpreadModeChanged?: (spreadMode: SpreadMode) => void
  onTriggerTranslateService?: (params: TranslateServiceInfo) => void
  onLoadError?: (loadError: any) => void
  onLoadProgress?: (e: any) => void
  onLoadSuccess?: (pdf: PDFDocumentProxy) => void
  onDocumentLoaded?: (pdf: PDFDocumentProxy) => void
  // 文本转高亮数据成功
  onTextToHighlight?: (payload: {
    source: TextToHighlight
    highlight: Highlight
  }) => void
}

export interface DocumentProps extends DocumentOptions {
  setPDFDocument: (pdfDocument: PDFDocumentProxy | null) => void
  setPDFViewer: (pdfViewer: PDFViewer | null) => void
  setPDFFindController: (pdfFindController: PDFFindController | null) => void
}

const Document: FC<DocumentProps> = (props) => {
  const {
    version,
    file,
    children,
    enableFind,
    defaultScale = ScaleMode.PAGE_WIDTH,
    defaultPageNumber = 1,
    cMapUrl = '/pdfjs/cmaps/',
    standardFontDataUrl = '/pdfjs/standard_fonts/',
    spreadMode = SpreadMode.READ,
    setPDFDocument,
    setPDFViewer,
    onTextToHighlight,
    onLoadError,
    onLoadProgress,
    onLoadSuccess,
    onDocumentLoaded,
    setPDFFindController,
    onSpreadModeChanged,
    onTriggerTranslateService,
  } = props
  const { t } = useI18n()
  const {
    pdfViewer,
    pdfDocument,
    linkService,
    eventBus,
    pdfFindController,
    renderingQueue,
    translationService,
    globalEnableTranslate,
  } = useDocumentContext()

  // 滚动容器
  const containerRef = useRef<HTMLDivElement>(null)
  // pdf 容器
  const pdfViewerRef = useRef<HTMLDivElement>(null)
  // pdf 加载任务
  const pdfLoadingTask = useRef<PDFDocumentLoadingTask | null>(null)

  // 加载资源失败
  const [loadError, setLoadError] = useState<any>(null)

  const hooks = {
    containerRef,
    pdfViewerRef,
    onSpreadModeChanged,
    onTextToHighlight,
    onTriggerTranslateService,
  }

  const scaleRef = useRef(defaultScale)

  /** ----------------------------------------- 事件监听 ----------------------------------------- */

  const { onPointerMove, onPointerLeave } = useBindEvent(hooks)

  const { onScrollY, onScrollX } = useWatchScroll(hooks)

  usePDFEvent(PDFViewerEvent.ScaleChanging, ({ source }) => {
    pdfViewer?.update()
    scaleRef.current = source.currentScaleValue as any
  })

  /** ----------------------------------------- 初始化加载 ----------------------------------------- */

  const setInitialView = (pdfViewer: PDFViewer) => {
    if (!pdfViewer) return
    const pageNumber =
      defaultPageNumber > linkService.pagesCount ? 1 : defaultPageNumber
    pdfViewer.scrollPageIntoView({
      pageNumber: pageNumber,
      scale: scaleRef.current,
      top: -Math.floor(VERTICAL_PADDING / 2),
    })
  }

  const load = (pdfDocument: PDFDocumentProxy) => {
    if (!containerRef.current || !pdfViewerRef.current) {
      return
    }

    let findController = pdfFindController
    let viewer = pdfViewer

    if (!findController) {
      findController = new PDFFindController({
        eventBus: eventBus,
        linkService: linkService,
        container: containerRef.current,
        updateMatchesCountOnProgress: enableFind,
      })
      setPDFFindController(findController)
    } else {
      findController.updateContainer(containerRef.current)
    }

    if (!viewer) {
      viewer = new PDFViewer({
        version: version!,
        container: containerRef.current,
        viewer: pdfViewerRef.current,
        linkService: linkService,
        eventBus: eventBus,
        findController: findController,
        renderingQueue: renderingQueue,
        translationService,
        spreadMode,
        i18n: {
          orcTooltip: t('pdfViewer.ocr.tooltip'),
          translating: t('pdfViewer.common.translating'),
          retry: t('pdfViewer.error.retry'),
          transFailed: t('pdfViewer.error.trans-failed'),
          fetchDataError: t('pdfViewer.error.fetch-data-error'),
        },
      })
      setPDFViewer(viewer)
    } else {
      viewer.updateViewer({
        container: containerRef.current,
        viewer: pdfViewerRef.current,
      })
    }
    translationService.linkService = linkService
    viewer.setDocument(pdfDocument)
    linkService.setDocument(pdfDocument)
    linkService.setViewer(viewer)

    eventBus.emit(PDFViewerEvent.DocumentInit, { source: pdfDocument })

    setPDFViewer(viewer)
    setPDFDocument(pdfDocument)
    onLoadSuccess?.(pdfDocument)

    const { firstPagePromise } = viewer

    firstPagePromise?.then((pdfPage) => {
      setInitialView(viewer)
      onDocumentLoaded?.(pdfDocument)
    })
  }

  // 加载取消令牌
  const loadingCancelToken = useRef<{ cancelled: boolean } | null>(null)

  const destroyPDFLoadingTask = async () => {
    if (!pdfLoadingTask.current) return
    if (pdfDocument) {
      pdfViewer!.setDocument(null)
      linkService.setDocument(null)
    }
    const task = pdfLoadingTask.current
    setPDFDocument(null)
    setPDFViewer(null)
    setLoadError(null)
    try {
      await task.destroy()
    } catch (error) {
      console.error('Error destroying PDF loading task', error)
    } finally {
      pdfLoadingTask.current = null
    }
  }

  const loadDocument = useMemoizedFn(async (file: string) => {
    const cancelToken = { cancelled: false }
    loadingCancelToken.current = cancelToken

    eventBus.emit(PDFViewerEvent.DocumentLoadStart)

    if (pdfLoadingTask.current) {
      await destroyPDFLoadingTask()
    }

    if (cancelToken.cancelled) {
      return
    }

    let loadingTask: PDFDocumentLoadingTask | null = null

    try {
      loadingTask = pdfjsLib.getDocument({
        url: file,
        cMapUrl: baseURL + cMapUrl,
        standardFontDataUrl: baseURL + standardFontDataUrl,
      })
      loadingTask.onProgress = (e: any) => {
        if (cancelToken.cancelled) {
          return
        }
        onLoadProgress?.(e)
      }
      pdfLoadingTask.current = loadingTask

      const pdfDocument = await loadingTask.promise
      if (cancelToken.cancelled) {
        await loadingTask.destroy()
        return
      }
      load(pdfDocument)
      setRetryCount(0)
    } catch (error) {
      if (loadingTask?.destroyed || cancelToken.cancelled) {
        return
      }
      console.error('Error loading PDF document', error)
      setLoadError(error)
      onLoadError?.(error)
      eventBus.emit(PDFViewerEvent.DocumentLoadError, { source: error })
    }
  })

  const debounceLoadDocument = useMemo(
    () => debounce(loadDocument, 300),
    [loadDocument],
  )

  const [retryCount, setRetryCount] = useState(0)

  const handleRetry = () => {
    debounceLoadDocument(file)
    setRetryCount(retryCount + 1)
  }

  // 加载 pdf
  useAsyncEffect(async () => {
    debounceLoadDocument(file)
  }, [file])

  useEffect(() => {
    return () => {
      if (loadingCancelToken.current) {
        loadingCancelToken.current.cancelled = true
      }
    }
  }, [file])

  return (
    <div
      ref={containerRef}
      className="pdf-container-document custom-scrollbar custom-scrollbar-float custom-scrollbar-hidden relative h-full w-0 flex-1 overflow-y-auto py-3 pr-1 pl-3"
      onScroll={onScrollY}
      style={
        {
          '--scrollbar-margin-block': '12px',
          scrollbarGutter: 'stable',
        } as React.CSSProperties
      }
    >
      <div className="overflow-x-auto overflow-y-visible" onScroll={onScrollX}>
        <div
          className="pdfViewer"
          ref={pdfViewerRef}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        ></div>
      </div>
      {/* loading pdf */}
      {pdfDocument === null && !loadError && (
        <div className="bg-grey-layer2-normal flex-center absolute inset-0 m-[12px] overflow-hidden rounded-[8px]">
          <span className="text-brand-primary-normal">
            <Loading size={32} className="animate-spin" />
          </span>
        </div>
      )}
      {/* loadError */}
      {loadError && (
        <div className="bg-grey-layer2-normal flex-center absolute inset-0 m-[12px] overflow-hidden rounded-[8px]">
          <div className="f-i-center flex-col">
            <span className="text-error-normal shrink-0">
              <ExclamationMarkCircleFilledError size={24} />
            </span>
            <span className="text-text-primary-1 font-normal-16 mt-[8px] mb-[16px]">
              {t('pdfViewer.error.load-failed')}
            </span>
            <button
              onClick={handleRetry}
              className="bg-grey-fill2-normal text-text-primary-1 font-normal-12 hover:bg-grey-fill2-hover rounded-md px-3 py-1 transition-colors"
            >
              {t('pdfViewer.error.retry')}
            </button>
          </div>
        </div>
      )}
      {globalEnableTranslate && <TranslationSpotlight />}
      {children}
    </div>
  )
}

export default memo(Document)
