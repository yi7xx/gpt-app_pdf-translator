import { type PDFDocumentProxy } from 'pdfjs-dist'
import { UIEvents, type PDFEventBus } from '../events'
import { TranslationServiceManager } from '../services/TranslationServiceManager'
import { ConcurrencyController } from '../utils/concurrencyController'
import { PDFTransPageViewPrint } from './PDFTransPageView'
import {
  PDFTransViewerUIManager,
  TranslationStatus,
  type Paragraph,
  type TranslationState,
} from './PDFTransViewerUIManager'
import { PDFViewer } from './PDFViewer'

interface PDFPrintConfig {
  // 是否自动旋转
  autoRotate: boolean
  // 是否强制竖屏
  forcePortrait: boolean
  // 是否强制横屏
  forceLandscape: boolean
}

interface PDFPrintServiceOptions {
  eventBus: PDFEventBus
  pdfDocument: PDFDocumentProxy
  pdfViewer: PDFViewer
  printContainer: HTMLElement
  docFileName: string
  printConfig?: PDFPrintConfig
  beforePrint?: (source: PDFPrintService) => Promise<void>
  afterPrint?: (source: PDFPrintService) => Promise<void> | void
}

// 下载任务队列
class PDFPrintTask {
  private static downloadQueue: (() => Promise<void>)[] = []
  private static isRunning = false

  private static async run() {
    if (this.isRunning || this.downloadQueue.length === 0) {
      return
    }

    this.isRunning = true
    try {
      const task = this.downloadQueue.shift()!
      await task()
    } catch (error) {
      console.error('Print task failed:', error)
    } finally {
      this.isRunning = false
      if (this.downloadQueue.length > 0) {
        this.run()
      }
    }
  }

  static addTask(task: () => Promise<void>) {
    this.downloadQueue.push(task)
    this.run()
  }
}

export class PDFPrintService {
  public key: string
  private _total: number
  private _completed: number
  private static prefix = 'pdf-print-service-'
  private static id = 0
  private pdfDocument: PDFDocumentProxy
  private pdfViewer: PDFViewer
  private eventBus: PDFEventBus
  private translationService: TranslationServiceManager
  private printContainer: HTMLElement
  private pageStyleSheet: HTMLStyleElement | null
  private transUIManager: PDFTransViewerUIManager
  private isUnmounted = false
  /**
   * 打印模式
   * direct: 直接打印
   * translate: 翻译后打印
   */
  private mode: 'direct' | 'translate'
  private beforePrint?: (source: PDFPrintService) => Promise<void>
  private afterPrint?: (source: PDFPrintService) => Promise<void> | void
  private concurrencyController: ConcurrencyController
  private domCurrencyController: ConcurrencyController
  private readonly MAX_CONCURRENCY = 10
  private readonly MAX_DOM_CONCURRENCY = 1
  private readonly taskIdMap = new Map<string, number>()
  private translationsPages: TranslationState[] = []
  private transPrintPages: PDFTransPageViewPrint[] = []
  private docFileName: string
  private docTitle: string | null = null
  private printConfig: PDFPrintConfig
  private clearPrintTimer: (() => void) | null = null
  private containerWidth = 0
  private containerHeight = 0
  // 标记pdf是否为竖屏PDF
  private markPortrait = false
  // 标记pdf是否为横屏PDF
  private markLandscape = false

  constructor(options: PDFPrintServiceOptions) {
    const {
      pdfDocument,
      printContainer,
      eventBus,
      pdfViewer,
      docFileName,
      printConfig,
      beforePrint,
      afterPrint,
    } = options
    this.pdfDocument = pdfDocument
    this.printContainer = printContainer
    this.eventBus = eventBus
    this.pdfViewer = pdfViewer
    this.transUIManager = pdfViewer.transUIManager!
    this.translationService = this.transUIManager.translationService
    this.pageStyleSheet = null
    this.mode = 'direct'
    this._total = 0
    this._completed = 0
    this.docFileName = docFileName
    this.printConfig = Object.assign(
      { autoRotate: true, forcePortrait: false, forceLandscape: false },
      printConfig,
    )
    this.key = PDFPrintService.getUniqueKey()
    this.concurrencyController = new ConcurrencyController(this.MAX_CONCURRENCY)
    // dom 渲染
    this.domCurrencyController = new ConcurrencyController(
      this.MAX_DOM_CONCURRENCY,
      'dom_task_',
    )
    this.beforePrint = beforePrint
    this.afterPrint = afterPrint
  }

  get total() {
    return this._total
  }

  get completed() {
    return this._completed
  }

  private static getUniqueKey() {
    return `${this.prefix}${this.id++}`
  }

  // 下载前准备，并添加下载任务
  async prepareDownload(mode: 'direct' | 'translate') {
    this.mode = mode
    this.translationsPages = await this.transUIManager.getTranslationsPages()
    this._total = this.translationsPages.length
    PDFPrintTask.addTask(this.createDownloadTask.bind(this))
  }

  private normalizeIsPortrait(isPortrait: boolean) {
    const { forcePortrait, forceLandscape, autoRotate } = this.printConfig
    this.markPortrait = false
    this.markLandscape = false
    if (forcePortrait) {
      this.markPortrait = true
      return
    }
    if (forceLandscape) {
      this.markLandscape = true
      return
    }
    if (autoRotate) {
      if (isPortrait) {
        this.markPortrait = true
      } else {
        this.markLandscape = true
      }
    }
  }

  // 布局页面
  private async layout() {
    const pagesOverview = await this.pdfViewer.getTransPagesOverview()
    for (let pageNum = 1; pageNum <= pagesOverview.length; pageNum++) {
      const pageOverview = pagesOverview[pageNum - 1]
      if (pageOverview === null) {
        this.translateError(pageNum)
        return
      }
    }
    const body = document.querySelector('body')!
    body.setAttribute('data-pdfjsprinting', 'true')
    this.printContainer.classList.add('pdfPrintLayouting')

    const { width, height, scale } = pagesOverview[0]!
    const hasEqualPageSizes = pagesOverview.every(
      (size) => size!.width === width && size!.height === height,
    )
    const maxWidth = Math.max(...pagesOverview.map((size) => size!.width))
    const maxHeight = Math.max(...pagesOverview.map((size) => size!.height))
    if (!hasEqualPageSizes) {
      console.warn(
        'Not all pages have the same size. The printed result may be incorrect!',
      )
    }
    this.normalizeIsPortrait(width < height)
    this.containerWidth = maxWidth
    this.containerHeight = maxHeight
    this.printContainer.style.setProperty('--scale-factor', `${scale}`)
    this.pageStyleSheet = document.createElement('style')
    this.pageStyleSheet.textContent = `@page { size: ${maxWidth}px ${maxHeight}px;}`
    body.append(this.pageStyleSheet)
  }

  private async translateError(
    pageNumber: number,
    // 翻译失败 或者 拉取数据失败
    reason: 'translate' | 'fetchData' = 'translate',
    showTooltip = true,
  ) {
    this.transUIManager.updateTranslationState(pageNumber, {
      status:
        reason === 'fetchData'
          ? TranslationStatus.FetchDataError
          : TranslationStatus.TranslatingError,
    })
    if (this.isUnmounted) {
      return
    }
    this.eventBus.emit(UIEvents.DownloadTranslateError, {
      source: this,
      mode: this.mode,
      pageNumber,
      reason,
      showTooltip,
    })
    this.destroy()
  }

  // 直接打印模式
  private async directPrint(
    pageNumber: number,
    paragraphs: Paragraph[],
    version: string,
  ) {
    const pageIndex = pageNumber - 1
    const transState = this.translationsPages[pageIndex]
    if (!transState) {
      this.translateError(pageNumber)
      return
    }
    paragraphs.forEach((paragraph) => {
      paragraph.text = paragraph.text || paragraph.sourceText
    })
    this.translationsPages[pageIndex] = {
      ...transState,
      paragraphs,
      version,
    }
  }

  // 翻译后打印模式
  private async translatePrint(
    pageNumber: number,
    paragraphs: Paragraph[],
    version: string,
  ) {
    const pageIndex = pageNumber - 1
    const transState = this.translationsPages[pageIndex]
    if (!transState) {
      this.translateError(pageNumber)
      return
    }
    const { status } = transState
    // 如果都存在翻译文本且不处于强制翻译状态则不需要翻译
    if (
      status !== TranslationStatus.ForceTranslating &&
      paragraphs.every((paragraph) => paragraph.text)
    ) {
      return
    }
    const texts = paragraphs.map((paragraph) => paragraph.sourceText)
    const result = await this.transUIManager.printTranslate(pageNumber, texts)
    const { isError, data, showTooltip } = result
    if (isError || !data) {
      this.translateError(pageNumber, 'translate', showTooltip)
      return result
    }
    if (!data.length) {
      return
    }
    paragraphs = paragraphs.map((paragraph, index) => {
      paragraph!.text = data[index]!
      return paragraph
    })
    this.translationsPages[pageIndex] = {
      ...transState,
      status: TranslationStatus.TranslatingDone,
      paragraphs,
      version,
    }
    this.transUIManager.updateTranslationAndStorage(
      pageNumber,
      paragraphs,
      version,
    )
    this.transUIManager.tryRenderParagraphs(pageNumber, paragraphs)
  }

  // 准备翻译页面，提供数据
  private async prepareTranslatePage(pageNumber: number) {
    const pageIndex = pageNumber - 1
    const transState = this.translationsPages[pageIndex]
    if (!transState) {
      this.translateError(pageNumber)
      return { isError: true, data: null, message: 'Failed to translate' }
    }
    const { paragraphs, version, status, isFetched } = transState
    if (status === TranslationStatus.TranslatingDone) {
      return
    }
    let newParagraphs = paragraphs
    let newVersion = version || this.transUIManager.getVersion(false)
    if (!isFetched) {
      const { isError, data } =
        await this.transUIManager.fetchPageData(pageNumber)
      if (isError) {
        return
      }
      const { paragraphs, version } = data

      if (paragraphs.length) {
        newParagraphs = paragraphs
        newVersion = version
        this.transUIManager.updateTranslationState(pageNumber, {
          paragraphs: newParagraphs,
          version: newVersion,
        })
        this.translationsPages[pageIndex] = {
          ...transState,
          paragraphs: newParagraphs,
          version: newVersion,
        }
      }
    }

    const { paragraphs: maybeOCRParagraphs } =
      this.translationsPages[pageIndex]!
    if (!maybeOCRParagraphs?.length) {
      return
    }
    if (this.mode === 'direct') {
      return this.directPrint(pageNumber, newParagraphs, newVersion)
    }
    return this.translatePrint(pageNumber, newParagraphs, newVersion)
  }

  // 根据页面添加翻译dom
  private async addTranslateDom(pageNumber: number, div: HTMLDivElement) {
    // 找到正确的插入位置
    const pages = Array.from(this.printContainer.children)
    const insertPosition = pages.findIndex((page) => {
      const pageNum = parseInt(page.getAttribute('data-page-number') || '0')
      return pageNum > pageNumber
    })
    if (insertPosition !== -1) {
      this.printContainer.insertBefore(div, pages[insertPosition]!)
    } else {
      this.printContainer.appendChild(div)
    }
  }

  // 生成页面
  private async generatePage(pageNumber: number) {
    const { promise, taskId } = this.domCurrencyController.run(async () => {
      const transPrintPage = new PDFTransPageViewPrint({
        id: pageNumber,
        pdfViewer: this.pdfViewer,
        pdfDocument: this.pdfDocument,
        paragraph: this.translationsPages[pageNumber - 1]?.paragraphs || [],
      })
      this.transPrintPages[pageNumber - 1] = transPrintPage
      this.addTranslateDom(pageNumber, transPrintPage.div)
      const transPageView = this.pdfViewer.getTransPageView(pageNumber)!
      const viewport = transPageView.pdfPage!.getViewport({ scale: 1 })
      await transPrintPage.printDraw(transPageView.pdfPage!, viewport)
    })
    this.taskIdMap.set(taskId, pageNumber)
    return promise.then(() => {
      this.taskIdMap.delete(taskId)
    })
  }

  // 渲染页面
  private async renderPage(pageNumber: number) {
    const { promise, resolve } = Promise.withResolvers<void>()
    try {
      await this.prepareTranslatePage(pageNumber)
      await this.generatePage(pageNumber)
    } finally {
      resolve()
    }
    return promise
  }

  // 翻译页面
  private async translatePages() {
    const concurrencyController = this.concurrencyController
    const tasks: { task: () => Promise<any> }[] = []
    this.translationsPages.forEach((_, index) => {
      const pageNumber = index + 1
      tasks.push({
        task: () => this.renderPage(pageNumber),
      })
    })
    const { promise, results } = concurrencyController.runBatch(
      tasks,
      ({ taskId, completed, total, result }) => {
        // 已经发送的请求，如果已经卸载，则不更新状态
        if (this.isUnmounted) {
          return
        }
        this._completed = completed
        this._total = total
        this.taskIdMap.delete(taskId)
        this.eventBus.emit(UIEvents.DownloadUpdateTranslating, {
          source: this,
          current: completed,
          total,
        })
      },
    )
    results.forEach(({ taskId }, index) => {
      const pageNumber = index + 1
      this.taskIdMap.set(taskId, pageNumber)
    })
    return promise.then(() => {
      if (this.isUnmounted) {
        return
      }
      this.eventBus.emit(UIEvents.DownloadTranslateDone, {
        source: this,
      })
    })
  }

  // 打印页面
  private async performPrint() {
    if (this.isUnmounted) {
      return
    }
    this.printContainer.classList.remove('pdfPrintLayouting')
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        window.print()
        resolve(null)
      }, 0)
      this.clearPrintTimer = () => {
        resolve(null)
        clearTimeout(timer)
      }
    })
  }

  // 销毁
  destroy() {
    if (this.concurrencyController.hasTask) {
      this.concurrencyController.cancelAll()
    }
    if (this.domCurrencyController.hasTask) {
      this.domCurrencyController.cancelAll()
    }
    this.isUnmounted = true
    this.clearPrintTimer?.()
    this.printContainer.removeAttribute('class')
    this.printContainer.style.removeProperty('--scale-factor')
    this.printContainer.textContent = ''
    this._total = 0
    this._completed = 0
    this.translationsPages = []
    this.transPrintPages = []
    this.taskIdMap.clear()
    const body = document.querySelector('body')!
    body.removeAttribute('data-pdfjsprinting')
    this.pageStyleSheet?.remove()
    this.pageStyleSheet = null
    PDFPrintServiceFactory.removePrintService(this)
  }

  setTitle(title = this.docFileName) {
    document.title = title
  }

  private async createDownloadTask() {
    try {
      this.pdfViewer.isPrinting = true
      await this.layout()
      await this.translatePages()
      if (this.isUnmounted) {
        return
      }
      this.docTitle = document.title
      this.setTitle()
      await this.beforePrint?.(this)
      await this.performPrint()
    } finally {
      this.pdfViewer.isPrinting = false
      if (this.docTitle) {
        document.title = this.docTitle
      }
      if (this.isUnmounted) {
        return
      }
      await this.afterPrint?.(this)
      this.destroy()
    }
  }

  rebuild(mode: 'direct' | 'translate') {
    this.isUnmounted = false
    this.prepareDownload(mode)
  }
}

export class PDFPrintServiceFactory {
  static printServiceMap = new Map<PDFPrintService, PDFDocumentProxy>()
  static pdfDocumentMap = new Map<PDFDocumentProxy, PDFPrintService>()

  static removePrintService(printService: PDFPrintService) {
    this.pdfDocumentMap.delete(this.printServiceMap.get(printService)!)
    this.printServiceMap.delete(printService)
  }

  static createPrintService(options: PDFPrintServiceOptions) {
    if (this.pdfDocumentMap.has(options.pdfDocument)) {
      // 如果已经正在翻译，则返回null
      return null
    }
    const printService = new PDFPrintService(options)
    this.pdfDocumentMap.set(options.pdfDocument, printService)
    this.printServiceMap.set(printService, options.pdfDocument)
    return printService
  }
}
