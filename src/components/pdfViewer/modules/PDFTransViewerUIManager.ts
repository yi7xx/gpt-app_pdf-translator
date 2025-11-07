/* eslint-disable max-lines */
import { PixelsPerInch } from 'pdfjs-dist'
import {
  type PDFDocumentProxy,
  type TextContent,
} from 'pdfjs-dist/types/src/display/api'
// import { retryMessage } from '../../utils/message'
import {
  PDFTransViewerEvents,
  TransServerEvents,
  type PDFEventBus,
} from '../events'
import {
  TranslationServiceManager,
  type TranslateResult,
} from '../services/TranslationServiceManager'
import { extractParagraphs, mergeOCRParagraphs } from '../utils/paragraphParser'
import { LinkService } from './LinkService'
import { PDFTransEditorItem } from './PDFTransEditorItem'
import { PDFTransEditorLayer } from './PDFTransEditorLayer'
import { OCRStatus } from './PDFTransOCRLayer'
import { PDFViewer, SpreadMode } from './PDFViewer'

interface PDFTransViewerUIManagerOptions {
  linkService: LinkService
  eventBus: PDFEventBus
  pdfViewer: PDFViewer
  pdfDocument: PDFDocumentProxy
  translationService: TranslationServiceManager
}

// 当前翻译的状态流转
export enum TranslationStatus {
  // 初始态
  Default = 'default',
  // 强制翻译
  ForceTranslating = 'forceTranslating',
  // 翻译中
  Translating = 'translating',
  // 翻译完成
  TranslatingDone = 'translatingDone',
  // 翻译失败
  TranslatingError = 'translatingError',
  // 拉去数据失败
  FetchDataError = 'fetchDataError',
}

export interface Paragraph {
  // 原始文本
  sourceText: string
  // 翻译模型
  model?: string
  // 翻译后的文本
  text: string | null
  // 字号
  fontSize: number
  // 字体
  fontFamily?: string
  // 是否加粗
  isBold?: boolean
  // 是否斜体
  isItalic?: boolean
  // 是否为标注内容
  isMarked?: boolean
  // 文本旋转角度
  angle?: number
  /**
   * 合并的行数
   * 表示当前段落包含了多少个原始行
   * 默认为 0，总行数为 n + 1
   */
  mergeLine?: number
  /**
   * 是否为1px归一化后的坐标值
   * 用于区分坐标值是否经过1px转换处理
   * @default false 对于历史数据默认为false
   */
  std: boolean
  /**
   * 原始解析的文本矩形框，用于原始文档区域展示
   * [x, y, width, height]
   * 默认为1px进行转化，便于不同分辨率下进行适配和缩放
   * @example [0.07230391855596405, 0.022806802435133177, 0.5467325617782991, 0.023274738613552517]
   */
  box: readonly [number, number, number, number]
  /**
   * 自动布局后的文本矩形框
   * 默认与originalBox相等，在自动布局调整后会改变
   */
  layoutBox: [number, number, number, number]

  // 自定义翻译状态
  status?: TranslationStatus
  // 错误信息
  message?: string
}

// 当前翻译的对象存储
export interface TranslationState {
  version: string
  paragraphs: Paragraph[]
  // 是否需要ocr
  needOCR?: boolean
  // 翻译状态
  status: TranslationStatus
  // 标记已获取翻译数据
  isFetched?: boolean
  // 错误信息
  message?: string
}

// OCR前缀
const OCR_PREFIX = 'OCR_'

export class PDFTransViewerUIManager {
  public translationService: TranslationServiceManager
  private linkService: LinkService
  private eventBus: PDFEventBus
  private pdfViewer: PDFViewer
  private pdfDocument: PDFDocumentProxy
  private extractTextPromises: Promise<void>[]
  private eventAbortController: AbortController
  // 文本内容
  private pageContents: (TextContent | null)[]
  // 合并段落文本内容
  private translationStates: TranslationState[]
  // 合并原始段落文本内容
  private originalParagraphMap: Map<number, Paragraph[]> = new Map()
  // 所有编辑翻译项
  private allEditorItems: Map<string, PDFTransEditorItem> = new Map()
  private allLayers = new Map<number, PDFTransEditorLayer>()
  // 翻译请求
  private translatePageRequests: Record<number, Set<string>> = {}
  // ocr 请求状态
  private ocrRequests = new Set<number>()
  // 翻译请求Promise
  private translatePagePromise: Map<number, Promise<void>> = new Map()

  // 存储服务id
  private storageId: string = ''

  // 标记当前文档已卸载
  private _isUnloaded = false

  private _intent = 'display'

  constructor(options: PDFTransViewerUIManagerOptions) {
    this.linkService = options.linkService
    this.eventBus = options.eventBus
    this.pdfViewer = options.pdfViewer
    this.pdfDocument = options.pdfDocument
    this.translationService = options.translationService
    this.extractTextPromises = []
    this.pageContents = []
    this.translationStates = []
    this.eventAbortController = new AbortController()
    this.updateStorageId()
    this.bindEvent()
  }

  get enableTranslate() {
    return this.pdfViewer.spreadMode === SpreadMode.TRANSLATE
  }

  get realScale() {
    return this.pdfViewer.currentScale * PixelsPerInch.PDF_TO_CSS_UNITS
  }

  get intent() {
    return this._intent
  }

  get renderCacheKey() {
    return this.pdfDocument._transport.getRenderingIntent(this._intent).cacheKey
  }

  get storageService() {
    return this.translationService.storageService
  }

  get isUnloaded() {
    return this._isUnloaded
  }

  get isPrinting() {
    return this.pdfViewer.isPrinting
  }

  updateStorageId() {
    if (this.storageId) {
      return
    }
    this.storageId = this.translationService.storageService.id
  }

  private getTranslatePagePromise(pageNumber: number) {
    return this.translatePagePromise.get(pageNumber) || Promise.resolve()
  }

  getVersion(isOCR = false) {
    return `${isOCR ? OCR_PREFIX : ''}${this.translationService.version}`
  }

  async isOCR(pageNumber: number) {
    await this.extractTextPromises[pageNumber - 1]
    const translationState = this.translationStates[pageNumber - 1]
    if (!translationState) {
      return false
    }
    return translationState.version.startsWith(OCR_PREFIX)
  }

  private bindEvent() {
    this.eventBus.on(
      TransServerEvents.UPDATE_EDITOR_ITEM_STATE,
      this.updatePDFTransEditor.bind(this),
    )
  }

  private shouldUpdateStatus(
    pageNumber: number,
    state: Partial<TranslationState>,
  ) {
    const transPageView = this.pdfViewer.getTransPageView(pageNumber)
    if (!transPageView) {
      return true
    }
    return state.status !== transPageView.status
  }

  updateTranslationState(pageNumber: number, state: Partial<TranslationState>) {
    if (this._isUnloaded) {
      return
    }
    const oldState = this.translationStates[pageNumber - 1]
    if (!oldState) {
      return
    }
    const newState = Object.assign(oldState, state)
    const isUpdate = this.shouldUpdateStatus(pageNumber, state)
    if (!isUpdate) {
      return
    }
    this.eventBus.emit(PDFTransViewerEvents.TranslationStateUpdated, {
      source: this,
      pageNumber,
      state: newState,
    })
    const transPageView = this.pdfViewer.getTransPageView(pageNumber)
    if (transPageView) {
      transPageView.updateStatus(newState.status)
    }
  }

  // 设置翻译状态
  setTranslationState(pageNumber: number, status: TranslationStatus) {
    const transState = this.translationStates[pageNumber - 1]
    if (transState) {
      transState.status = status
    }
  }

  // 重置所有翻译状态
  resetTranslationStates() {
    this.translationStates.forEach((state) => {
      state.status = TranslationStatus.ForceTranslating
    })
  }

  private _extractTextsPromise(isForceTranslating = false) {
    if (this.extractTextPromises.length > 0) {
      return
    }
    let deferred = Promise.resolve()
    const timestamp = performance.now()
    const textOptions = {
      disableNormalization: true,
      includeMarkedContent: true,
    }
    for (let i = 0, ii = this.linkService.pagesCount; i < ii; i++) {
      const { promise, resolve } = Promise.withResolvers<void>()
      this.extractTextPromises[i] = promise
      deferred = deferred.then(() =>
        this.pdfDocument
          .getPage(i + 1)
          .then((pdfPage) => pdfPage.getTextContent(textOptions))
          .then(
            (textContent) => {
              this.pageContents.push(textContent)
              if (!this.translationStates[i]) {
                this.translationStates[i] = {
                  version: this.getVersion(false),
                  paragraphs: [],
                  status: isForceTranslating
                    ? TranslationStatus.ForceTranslating
                    : TranslationStatus.Default,
                }
              }
              resolve()
            },
            (reason) => {
              console.error(
                `Unable to get text content for page ${i + 1}`,
                reason,
              )
              this.pageContents[i] = null
              resolve()
            },
          ),
      )
    }
    deferred.then(() => {
      const endTime = performance.now()
      this.eventBus.emit(PDFTransViewerEvents.ExtractTextsDone, {
        source: this,
        timestamp: endTime - timestamp,
      })
    })
  }

  extractTexts(isForceTranslating = false) {
    const { firstPagePromise } = this.pdfViewer
    const pdfDocument = this.pdfDocument
    firstPagePromise?.then(() => {
      if (pdfDocument !== this.pdfDocument) {
        return
      }
      this._extractTextsPromise(isForceTranslating)
    })
  }

  private async ensurePdfPageLoaded(pageIndex: number) {
    const pageView = this.pdfViewer.transPages[pageIndex]
    if (!pageView) {
      return null
    }
    if (pageView.pdfPage) {
      return pageView.pdfPage
    }
    try {
      const pdfPage = await this.pdfDocument.getPage(pageView.id)
      if (!pageView.pdfPage) {
        pageView.setPdfPage(pdfPage)
      }
      return pdfPage
    } catch (reason) {
      console.error('Unable to get page for page view', reason)
      return null
    }
  }

  private async getParagraphs(pageNumber: number, print = false) {
    const pageIndx = pageNumber - 1
    const states = this.translationStates[pageIndx]
    const isOCR = print || (await this.isOCR(pageNumber))
    // 判断是否存在翻译文本，存在直接返回
    if (isOCR && states && states.paragraphs.find((p) => p.sourceText)) {
      return states.paragraphs
    }
    if (this.originalParagraphMap.has(pageNumber)) {
      return this.originalParagraphMap.get(pageNumber)!
    }
    await this.extractTextPromises[pageIndx]
    const textContent = this.pageContents[pageIndx]
    const pdfPage = await this.ensurePdfPageLoaded(pageIndx)
    if (!textContent || !pdfPage) {
      this.updateTranslationState(pageNumber, {
        status: TranslationStatus.Default,
      })
      return null
    }
    if (textContent.items.length === 0) {
      return []
    }
    const { paragraphs } = extractParagraphs(pdfPage, textContent)
    this.originalParagraphMap.set(pageNumber, paragraphs)
    return paragraphs
  }

  updateTransStatus(pageNumber: number) {
    const states = this.translationStates[pageNumber - 1]
    const transPageView = this.pdfViewer.getTransPageView(pageNumber)
    if (!states || !transPageView) {
      return
    }
    transPageView.updateStatus(states.status)
  }

  // 查找指定页面指定位置的编辑器
  findEditorItem(pageNumber: number, x: number, y: number) {
    const layer = this.allLayers.get(pageNumber)
    if (!layer) {
      return null
    }
    return layer.findEditorItem(x, y)
  }

  // 获取所有的翻译页面信息
  async getTranslationsPages() {
    // 等待所有页面的文本提取完成
    const states = this.translationStates.map(async (state, idx) => {
      const pageNumber = idx + 1
      const paragraphs = await this.getParagraphs(pageNumber, true)
      return {
        ...state,
        paragraphs: paragraphs || [],
      }
    })
    return Promise.all(states)
  }

  // 校验当前是否完成所有翻译页面
  checkTransPagesDone() {
    return this.translationStates.every(
      (state) => state.status === TranslationStatus.TranslatingDone,
    )
  }

  // 获取指定的翻译页面信息
  async getTranslationPage(pageNumber: number) {
    const pageIndx = pageNumber - 1
    const paragraphs = await this.getParagraphs(pageNumber)
    return {
      ...this.translationStates[pageIndx],
      paragraphs,
    }
  }

  addLayer(layer: PDFTransEditorLayer) {
    this.allLayers.set(layer.id, layer)
  }

  removeLayer(layerId: number) {
    this.allLayers.delete(layerId)
  }

  /**
   * 标准化段落
   */
  private async normalizeParagraphs(
    pageNumber: number,
    paragraphs: Paragraph[],
  ) {
    const pdfPage = await this.ensurePdfPageLoaded(pageNumber - 1)
    if (!pdfPage) {
      return null
    }
    const viewport = pdfPage.getViewport({ scale: 1 })
    const { pageWidth, pageHeight } = viewport.rawDims as any
    return paragraphs.map((p) => {
      if (p.std) {
        return p
      }
      const box = [
        p.box[0] / pageWidth,
        p.box[1] / pageHeight,
        p.box[2] / pageWidth,
        p.box[3] / pageHeight,
      ] as const
      return {
        ...p,
        std: true,
        box,
        layoutBox: [...box],
      } as Paragraph
    })
  }

  async ocr(
    file: Blob,
    options: {
      pageNumber: number
      scale: number
      width: number
      height: number
    },
  ) {
    const { pageNumber, width, height } = options
    if (this.ocrRequests.has(pageNumber)) {
      return
    }
    const paragraphs = await this.getParagraphs(pageNumber)
    const transOcrLayer =
      this.pdfViewer.getTransPageView(pageNumber)?.transOCRLayer
    if (!transOcrLayer || !paragraphs) {
      return
    }
    this.ocrRequests.add(pageNumber)
    transOcrLayer.updateStatus(OCRStatus.OCRING)
    const { data, isError } = await this.translationService.ocr(file, {
      ...options,
      paragraphs,
    })
    this.ocrRequests.delete(pageNumber)
    if (isError) {
      transOcrLayer.updateStatus(OCRStatus.NONE)
      return
    }
    transOcrLayer.updateStatus(OCRStatus.OCR_SUCCESS)
    const newParagraphs = mergeOCRParagraphs(data.paragraphs, width, height)
    this.updateTranslationState(pageNumber, {
      paragraphs: newParagraphs,
      version: this.getVersion(true),
      status: TranslationStatus.Default,
    })
    this.translatePage(pageNumber)
  }

  async fetchPageData(pageNumber: number) {
    const transPageView = this.pdfViewer.getTransPageView(pageNumber)
    if (transPageView) {
      transPageView.setDataLoaded(false)
      transPageView.fetcherLoading = true
    }
    try {
      const result = await this.storageService.get(pageNumber, this.storageId)
      const { isError, data } = result
      if (isError) {
        this.updateTranslationState(pageNumber, {
          status: TranslationStatus.FetchDataError,
        })
        return {
          isError,
          data: { paragraphs: [], version: this.getVersion(false) },
        }
      }
      // 标记为已获取翻译数据，前置条件请求成功
      this.updateTranslationState(pageNumber, {
        isFetched: true,
      })
      const newParagraphs = await this.normalizeParagraphs(
        pageNumber,
        data?.paragraphs || [],
      )
      const newVersion = data?.version || this.getVersion(false)
      return {
        isError,
        data: { paragraphs: newParagraphs || [], version: newVersion },
      }
    } finally {
      if (transPageView) {
        transPageView.fetcherLoading = false
        transPageView.setDataLoaded(true)
      }
    }
  }

  async renderParagraph(pageNumber: number) {
    const pageIndx = pageNumber - 1
    await this.extractTextPromises[pageIndx]
    const { status, needOCR, isFetched } = this.translationStates[pageIndx]!
    if (needOCR) {
      return
    }

    if (status === TranslationStatus.TranslatingDone) {
      this.renderParagraphs(
        pageNumber,
        this.translationStates[pageIndx]!.paragraphs,
      )
      return
    }

    if (status === TranslationStatus.Translating) {
      if (!this.pdfViewer.isPrinting) {
        this.renderParagraphs(
          pageNumber,
          this.translationStates[pageIndx]!.paragraphs,
        )
      }
      this.updateTranslationState(pageNumber, {
        status,
      })
      return
    }
    if (
      status === TranslationStatus.TranslatingError ||
      status === TranslationStatus.FetchDataError
    ) {
      this.updateTranslationState(pageNumber, {
        status,
      })
      return
    }

    // 如果已获取翻译数据，且状态为 forceTranslating，则直接翻译
    if (isFetched && status === TranslationStatus.ForceTranslating) {
      this.translatePage(pageNumber)
      return
    }

    let maybeOCR = false
    // 只存在 default 和 forceTranslating
    const { isError, data } = await this.fetchPageData(pageNumber)
    if (isError) {
      return
    }
    if (status === TranslationStatus.Default) {
      if (data.paragraphs.length) {
        this.updateTranslationState(pageNumber, {
          paragraphs: data.paragraphs,
          version: data.version,
          status: TranslationStatus.TranslatingDone,
        })
        this.renderParagraphs(pageNumber, data.paragraphs)
        return
      }
      maybeOCR = true
    } else if (status === TranslationStatus.ForceTranslating) {
      this.updateTranslationState(pageNumber, {
        version: data.version,
      })
    }
    this.translatePage(pageNumber, maybeOCR)
  }

  /**
   * 翻译页面
   */
  private async translatePage(pageNumber: number, maybeOCR = false) {
    const pageIndx = pageNumber - 1
    const transState = this.translationStates[pageIndx]
    if (!transState) {
      return
    }
    const { status, version } = transState
    const oldParagraphs = [...transState.paragraphs]

    if (
      status === TranslationStatus.Translating ||
      status === TranslationStatus.TranslatingError ||
      status === TranslationStatus.FetchDataError
    ) {
      return
    }
    const paragraphs = await this.getParagraphs(pageNumber)
    if (!paragraphs?.length) {
      // 标记为需要ocr
      if (maybeOCR && this.translationStates[pageIndx]) {
        this.translationStates[pageIndx]!.needOCR = true
      }
      return
    }
    const { promise, resolve } = Promise.withResolvers<void>()
    const texts = paragraphs.map((p) => p.sourceText)
    this.updateTranslationState(pageNumber, {
      paragraphs,
      status: TranslationStatus.Translating,
    })
    this.translatePagePromise.set(pageNumber, promise)
    try {
      // 翻译
      const {
        isError,
        data,
        model,
        message,
        stream = false,
        cancel,
      } = await this.translationService.batchTranslate(pageNumber, texts)
      // 请求错误
      if (isError || !data) {
        this.updateTranslationState(pageNumber, {
          paragraphs: [],
          status,
          message,
        })
        return
      }

      // 主动取消
      if (cancel) {
        this.updateTranslationState(pageNumber, {
          status: TranslationStatus.TranslatingDone,
          paragraphs: oldParagraphs,
        })
        // 重新渲染回来
        this.renderParagraphs(pageNumber, oldParagraphs)
        return
      }

      if (stream) {
        await this.processStreamTranslation(
          pageNumber,
          paragraphs,
          data as Response,
          model!,
          version,
        )
        return
      }
      await this.processNonStreamTranslation(
        pageNumber,
        paragraphs,
        data as string[],
        model!,
        version,
      )
    } finally {
      resolve()
      this.resolvePrintTranslatePromise(pageNumber)
      this.translatePagePromise.delete(pageNumber)
    }
  }

  // 解决打印翻译Promise
  private async resolvePrintTranslatePromise(pageNumber: number) {
    const { paragraphs } = await this.getTranslationPage(pageNumber)
    const texts = paragraphs?.map((p) => p.text!) || []
    this.translationService.presetTaskResult(pageNumber, {
      isError: false,
      data: texts,
    })
  }

  private async getTranslationTexts(
    pageNumber: number,
  ): Promise<TranslateResult<string[]>> {
    // 等待翻译层翻译完成
    await this.getTranslatePagePromise(pageNumber)
    const { paragraphs } = await this.getTranslationPage(pageNumber)
    const isError = !paragraphs
    const texts = paragraphs?.map((p) => p.text!) || []
    return { isError, data: texts, message: '' }
  }

  // 当前是否正在翻译
  async isPageTranslating(pageNumber: number) {
    await this.getParagraphs(pageNumber)
    const transState = this.translationStates[pageNumber - 1]
    if (!transState) {
      return null
    }
    return transState.status === TranslationStatus.Translating
  }

  private isPageTranslatingOrDone(pageNumber: number) {
    const { status } = this.translationStates[pageNumber - 1]!
    return (
      status === TranslationStatus.Translating ||
      status === TranslationStatus.TranslatingDone
    )
  }

  /**
   * 处理打印翻译任务
   */
  private async printTask(
    pageNumber: number,
    task: () => Promise<TranslateResult<string[] | null>>,
  ) {
    if (!this.isPrinting) {
      return task()
    }
    if (this.isPageTranslatingOrDone(pageNumber)) {
      return this.getTranslationTexts(pageNumber)
    }
    this.updateTranslationState(pageNumber, {
      status: TranslationStatus.Translating,
    })
    return task()
  }

  /**
   * 打印翻译
   * 如果翻译状态为 Translating，则先获取翻译数据，再进行打印
   */
  async printTranslate(pageNumber: number, texts: string[]) {
    if (this.isPageTranslatingOrDone(pageNumber)) {
      return this.getTranslationTexts(pageNumber)
    }
    return this.translationService.printTranslate(
      pageNumber,
      texts,
      this.printTask.bind(this),
    )
  }

  /**
   * 打印模式下尝试渲染页面
   */
  async tryRenderParagraphs(pageNumber: number, paragraphs: Paragraph[]) {
    const layer = this.allLayers.get(pageNumber)
    if (!layer || layer.hasEditorItem) {
      return
    }
    this.renderParagraphs(pageNumber, paragraphs)
  }

  private renderParagraphs(pageNumber: number, paragraphs: Paragraph[]) {
    if (this._isUnloaded) {
      return
    }
    const layer = this.allLayers.get(pageNumber)
    if (!layer) {
      return
    }
    // 确保渲染层没有元素
    if (layer.hasEditorItem) {
      layer.removeAllEditorItems()
    }
    // 后端处理字段存在空缺，需要兜底
    for (const paragraph of paragraphs) {
      if (paragraph) {
        layer.createAndAddNewEditor(paragraph)
      }
    }
    layer.autoLayout()
  }

  private processErrorItem(id: string, model: string) {
    // retryMessage('error', {
    //   key: id,
    //   content: this.pdfViewer.i18n.transFailed!,
    //   onRetry: () => {
    //     this.updatePDFTransEditorModel(id, model)
    //   },
    // })
  }

  /**
   * 更新翻译状态和存储
   */
  updateTranslationAndStorage(
    pageNumber: number,
    paragraphs: Paragraph[],
    version: string,
  ) {
    this.updateTranslationState(pageNumber, {
      paragraphs,
      status: TranslationStatus.TranslatingDone,
    })
    this.storageService.save(pageNumber, {
      version,
      id: this.storageId,
      paragraphs,
    })
  }

  // 处理流式翻译
  private async processStreamTranslation(
    pageNumber: number,
    paragraphs: Paragraph[],
    data: Response,
    model: string,
    version: string,
  ) {
    const { promise, resolve, reject } = Promise.withResolvers<string[]>()
    const editorMap = new Map<number, string>()
    const removeMap = new Map<number, string>()

    const processTexts = (texts: string[], done = false) => {
      if (this._isUnloaded) {
        return
      }
      texts.forEach((currentText, idx) => {
        const editorId = editorMap.get(idx)
        const layer = this.allLayers.get(pageNumber)
        if (!layer) {
          return
        }
        if (!editorId) {
          // TODO: 提示词存在问题，无法对应上具体的idx导致报错
          const paragraph = paragraphs[idx]
          if (!paragraph) {
            return
          }
          const editorItem = layer.createAndAddNewEditor({
            ...paragraph,
            layoutBox: [...paragraph.box],
            text: currentText,
            model,
          })
          editorMap.set(idx, editorItem.id)
          this.addTranslatePageRequest(pageNumber, editorItem.id)
          return
        }
        this.updatePDFTransEditorState(editorId, { text: currentText })
        if (idx !== texts.length - 1 && !removeMap.has(idx)) {
          this.removeTranslatePageRequest(pageNumber, editorId)
          removeMap.set(idx, editorId)
          return
        }
        if (done && idx === texts.length - 1) {
          this.removeTranslatePageRequest(pageNumber, editorId)
          layer.resetParagraphs()
        }
      })
    }
    const cleanRequestSet = () => {
      const requestSet = this.getTranslatePageRequestSet(pageNumber)
      for (const id of requestSet) {
        this.removeTranslatePageRequest(pageNumber, id)
      }
    }

    this.translationService.parseStream(
      model,
      data,
      (texts, done) => {
        if (done) {
          processTexts(texts, true)
          resolve(texts)
          return
        }
        processTexts(texts)
      },
      (error) => {
        reject(error)
      },
    )
    try {
      const texts = await promise
      const layer = this.allLayers.get(pageNumber)
      let newParagraphs: Paragraph[] = []
      if (layer) {
        newParagraphs = layer.paragraphs.map((p, idx) => ({
          ...p,
          model,
          text: texts[idx] || '',
        }))
        layer.removeAllEditorItems()
      } else {
        newParagraphs = paragraphs.map((p, idx) => ({
          ...p,
          model,
          text: texts[idx] || '',
        }))
      }
      this.renderParagraphs(pageNumber, newParagraphs)
      this.updateTranslationAndStorage(pageNumber, newParagraphs, version)
    } catch (error) {
      this.updateTranslationState(pageNumber, {
        message: `${error}`,
        status: TranslationStatus.TranslatingError,
      })
    } finally {
      cleanRequestSet()
    }
  }

  private async processStreamTranslationItem(
    model: string,
    id: string,
    data: Response,
  ) {
    const { promise, resolve } = Promise.withResolvers<void>()
    this.translationService.parseStream(
      model,
      data,
      (texts, done) => {
        const text = texts[0]
        if (done) {
          this.updatePDFTransEditorState(id, { text, model }, true)
          resolve()
          return
        }
        this.updatePDFTransEditorState(id, { text, model })
      },
      ({ showTooltip }) => {
        resolve()
        if (showTooltip) {
          this.processErrorItem(id, model)
        }
      },
    )
    return promise
  }

  // 处理非流式翻译
  private async processNonStreamTranslation(
    pageNumber: number,
    paragraphs: Paragraph[],
    data: string[] | null,
    model: string,
    version: string,
  ) {
    const newParagraphs = paragraphs.map((p, idx) => ({
      ...p,
      layoutBox: [...p.box] as [number, number, number, number],
      model,
      text: data?.[idx] || '',
    }))
    this.renderParagraphs(pageNumber, newParagraphs)
    this.updateTranslationAndStorage(pageNumber, newParagraphs, version)
  }

  private getEditorItemIndex(
    pageNumber: number,
    editorItem: PDFTransEditorItem,
  ) {
    const layer = this.allLayers.get(pageNumber)
    if (!layer) {
      return -1
    }
    return layer.findEditorItemIndex(editorItem)
  }

  // 获取翻译请求集合
  private getTranslatePageRequestSet(pageNumber: number) {
    return this.translatePageRequests[pageNumber] || new Set()
  }

  // 获取编辑器是否正在翻译
  isEditorItemTranslating(id: string) {
    const editorItem = this.allEditorItems.get(id)
    if (!editorItem) {
      return false
    }
    const pageNumber = editorItem.parent.id
    const requestSet = this.getTranslatePageRequestSet(pageNumber)
    return requestSet.has(id)
  }

  // 添加翻译请求
  private addTranslatePageRequest(pageNumber: number, id: string) {
    const requestSet = this.getTranslatePageRequestSet(pageNumber)
    requestSet.add(id)
    this.translatePageRequests[pageNumber] = requestSet
    this.eventBus.emit(PDFTransViewerEvents.TranslatePageRequestAdded, {
      source: this,
      pageNumber,
      id,
    })
  }

  // 移除翻译请求
  private removeTranslatePageRequest(pageNumber: number, id: string) {
    const requestSet = this.getTranslatePageRequestSet(pageNumber)
    requestSet.delete(id)
    this.translatePageRequests[pageNumber] = requestSet
    const states = this.translationStates[pageNumber - 1]
    // 判断是否触发自动布局
    if (
      states &&
      requestSet.size === 0 &&
      states.status === TranslationStatus.TranslatingDone
    ) {
      this.allLayers.get(pageNumber)?.autoLayout()
    }
    this.eventBus.emit(PDFTransViewerEvents.TranslatePageRequestRemoved, {
      source: this,
      pageNumber,
      id,
    })
  }

  private updatePDFTransEditor(evt: {
    id: string
    text?: string
    model?: string
    syncStorage?: boolean
  }) {
    const { id, text, model, syncStorage = false } = evt
    const editorItem = this.allEditorItems.get(evt.id)
    if (!editorItem) {
      return
    }
    if (model) {
      this.updatePDFTransEditorModel(id, model)
      return
    }
    if (typeof text === 'string') {
      this.updatePDFTransEditorState(id, { text }, syncStorage)
      // 触发自动布局
      this.removeTranslatePageRequest(editorItem.parent.id, id)
      return
    }
  }

  private updatePDFTransEditorState(
    id: string,
    state: {
      text?: string
      model?: string
    },
    syncStorage = false,
  ) {
    const { text, model } = state
    const editorItem = this.allEditorItems.get(id)
    if (!editorItem) {
      return
    }
    if (typeof text === 'string') {
      editorItem.updateText(text)
    }
    if (model) {
      editorItem.updateModel(model)
    }
    editorItem.resetParagraph()
    if (syncStorage) {
      const pageNumber = editorItem.parent.id
      const index = this.getEditorItemIndex(pageNumber, editorItem)
      if (index === -1) {
        return
      }
      const { version } = this.translationStates[pageNumber - 1] || {}
      if (!version) {
        return
      }
      this.storageService.update(pageNumber, {
        index,
        id: this.storageId,
        paragraph: editorItem.serialize(),
        version: version || this.getVersion(),
      })
    }
  }

  /**
   * 更新翻译编辑器模型
   */
  private async updatePDFTransEditorModel(id: string, model: string) {
    const editorItem = this.allEditorItems.get(id)
    if (!editorItem) {
      return
    }
    const pageNumber = editorItem.parent.id
    this.addTranslatePageRequest(pageNumber, id)
    try {
      const { isError, data, stream, showTooltip } =
        await this.translationService.translate(
          pageNumber,
          editorItem.paragraph.sourceText,
          model,
        )
      if (isError) {
        if (showTooltip) {
          this.processErrorItem(id, model)
        }
        return
      }
      if (stream && data) {
        await this.processStreamTranslationItem(model, id, data as Response)
        return
      }
      const newState = { text: data as string, model }
      this.updatePDFTransEditorState(id, newState, true)
    } finally {
      this.removeTranslatePageRequest(pageNumber, id)
    }
  }

  addPDFTransEditor(editorItem: PDFTransEditorItem) {
    this.allEditorItems.set(editorItem.id, editorItem)
  }

  getPDFTransEditor(id: string) {
    return this.allEditorItems.get(id)
  }

  destroy() {
    this._isUnloaded = true
    this.extractTextPromises = []
    this.pageContents = []
    this.translationStates = []
    this.allEditorItems.clear()
    this.allLayers.clear()
    this.eventAbortController.abort()
  }
}
