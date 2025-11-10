import {
  PDFViewerEvent,
  TranslationServiceManager,
  TranslationStorageService,
  type PDFEventBus,
  type Paragraph,
} from '@/components/pdfViewer'

interface BatchData {
  version: string
  block_data: Record<string, Paragraph>
}

// 本地存储 Map: fileId -> pageNumber -> BatchData
const localStorageMap = new Map<string, Map<number, BatchData>>()

// 批量存储数据
class BatchSaveData {
  // 请求队列
  private requestQueue: Record<string, Record<number, BatchData>>
  // 定时器
  private timer: NodeJS.Timeout | null = null
  // 批量保存的时间间隔（单位：毫秒）
  private batchInterval: number
  constructor(batchInterval: number = 5 * 1000) {
    this.requestQueue = {}
    this.batchInterval = batchInterval
  }

  // 入口
  save(id: string, pageNumber: number, data: BatchData) {
    this.createRequestQueue(id, pageNumber, data)
    this.startBatchSaveTimer()
  }

  // 创建请求队列
  private createRequestQueue(id: string, pageNumber: number, data: BatchData) {
    if (!this.requestQueue[id]) {
      this.requestQueue[id] = {}
    }
    this.requestQueue[id]![pageNumber] = data
  }

  // 创建定时器
  private startBatchSaveTimer() {
    if (this.timer) {
      return
    }
    if (Object.keys(this.requestQueue).length === 0) {
      return
    }
    this.timer = setTimeout(() => {
      // 获取第一个请求队列，按理来说，应该只有存在一个请求队列
      const [id, datas] = Object.entries(this.requestQueue)[0]!
      delete this.requestQueue[id]
      this.batchSave(id, datas)
      this.timer = null
    }, this.batchInterval)
  }

  // 批量保存
  private async batchSave(
    id: string,
    datas: Record<number | string, BatchData>,
  ) {
    try {
      // 获取或创建该文件的存储
      if (!localStorageMap.has(id)) {
        localStorageMap.set(id, new Map())
      }
      const fileStorage = localStorageMap.get(id)!

      // 保存所有页面数据
      Object.keys(datas).forEach((pageNumber) => {
        fileStorage.set(Number(pageNumber), datas[pageNumber]!)
      })

      this.startBatchSaveTimer()
      return { isError: false, data: null, message: '' }
    } catch (error) {
      // 重新加入队列
      this.reAddRequestQueue(id, datas)
      this.startBatchSaveTimer()
      return { isError: true, data: null, message: 'Save failed' }
    }
  }

  // 重新加入对垒
  private reAddRequestQueue(
    id: string,
    datas: Record<number | string, BatchData>,
  ) {
    const newDatas = this.requestQueue[id]
    const newQueue = { ...datas, ...newDatas }
    this.requestQueue[id] = newQueue
  }
}

// 批量 get 数据
class BatchGetData {
  /**
   * 页码 -> 数据
   *
   * 数据为 null 时，表示该页码数据未存储
   * 数据为 false 时，表示该页码数据获取失败
   */
  private pagesData: Record<
    number,
    PromiseWithResolvers<BatchData | null | false>
  > = {}
  // 获取页数范围
  private pageRange: number
  // pdf 总页数
  private maxPage: number
  // 重试次数
  private retry: number = 2

  constructor(
    options: {
      pageRange?: number
      maxPage?: number
      retry?: number
    } = {},
  ) {
    this.pageRange = options?.pageRange || 20
    this.maxPage = options?.maxPage || Number.MAX_SAFE_INTEGER
    this.retry = options?.retry || 2
  }

  // 入口
  async get(pageNumber: number, id: string) {
    if (!this.pagesData[pageNumber]) {
      await this.batchGet(pageNumber, id)
    }
    // 被卸载时，pageData 不存在
    if (!this.pagesData[pageNumber]) {
      return this.getSinglePage(pageNumber, id)
    }
    const pageData = await this.pagesData[pageNumber]!.promise
    if (pageData === false) {
      return this.getSinglePage(pageNumber, id)
    }
    return { isError: false, data: pageData, message: '' }
  }

  updateMaxPage(maxPage: number) {
    this.maxPage = maxPage
  }

  private getPageRange(pageNumber: number): [number, number] {
    // 需要考虑前置页码
    let start = pageNumber
    const maxStart = Math.max(Math.floor(pageNumber - this.pageRange / 2), 1)
    while (start > maxStart && !this.pagesData[start]) {
      start--
    }
    const end = Math.min(start + this.pageRange - 1, this.maxPage)
    return [start, end]
  }

  // 注册范围内的请求
  private registerPromise(start: number, end: number) {
    for (let i = start; i <= end; i++) {
      if (this.pagesData[i]) {
        continue
      }
      this.pagesData[i] = Promise.withResolvers()
    }
  }

  // 兼容老数据
  private compatibleData(data: BatchData) {
    let version = data.version
    if (version === '1.0.1') {
      version = '1.0.2'
    } else if (version === 'OCR') {
      version = 'OCR_1.0.2'
    }
    return {
      version,
      block_data: data.block_data,
    }
  }

  // 批量解决promise
  private resolvePromises(
    start: number,
    end: number,
    pagesData: Record<number, BatchData | false>,
  ) {
    for (let i = start; i <= end; i++) {
      const pageData = pagesData[i]
      // pdf 被卸载时， pageData 不存在
      if (!this.pagesData[i]) {
        continue
      }
      if (typeof pageData === 'boolean') {
        this.pagesData[i]!.resolve(false)
      }
      // 如果 pageData 为空，表示该页码未存储数据
      else if (!pageData || Object.keys(pageData).length === 0) {
        this.pagesData[i]!.resolve(null)
      } else {
        this.pagesData[i]!.resolve(this.compatibleData(pageData))
      }
    }
  }

  private async batchGet(pageNumber: number, id: string, retry = this.retry) {
    const [start, end] = this.getPageRange(pageNumber)
    this.registerPromise(start, end)

    try {
      const fileStorage = localStorageMap.get(id)
      const data: Record<number, BatchData | false> = {}

      // 从本地存储读取数据
      for (let i = start; i <= end; i++) {
        const pageData = fileStorage?.get(i)
        if (pageData) {
          data[i] = pageData
        } else {
          // 页面数据不存在，返回空对象表示未存储
          data[i] = { version: '', block_data: {} }
        }
      }

      this.resolvePromises(start, end, data)
    } catch (error) {
      if (retry > 0) {
        this.batchGet(pageNumber, id, retry - 1)
        return
      }
      this.resolvePromises(start, end, new Array(end + 1).fill(false))
    }
  }

  // 当数据为null时，单独请求这页数据
  private async getSinglePage(pageNumber: number, id: string) {
    try {
      const fileStorage = localStorageMap.get(id)
      const data = fileStorage?.get(pageNumber)

      if (!data) {
        return { isError: false, data: null, message: '' }
      }

      return { isError: false, data: this.compatibleData(data), message: '' }
    } catch (error) {
      return { isError: true, data: null, message: 'Get single page failed' }
    }
  }

  destroy() {
    this.pagesData = {}
  }
}

export class TranslatorStorageService extends TranslationStorageService {
  public id: string = ''
  private serverManager: TranslationServiceManager | null = null
  private _fileId: string = ''
  private batchGetData: BatchGetData
  private batchSaveData: BatchSaveData
  // 总页数
  private maxPage: number = 0
  // 批量保存的间隔时间
  private readonly batchSaveInterval: number = 5 * 1000

  constructor() {
    super()
    this.serverManager = null
    this.batchGetData = new BatchGetData()
    this.batchSaveData = new BatchSaveData(this.batchSaveInterval)
  }

  set fileId(fileId: string) {
    this.id = fileId
    this._fileId = fileId
    if (this.serverManager?.linkService?.pdfViewer?.transUIManager) {
      this.serverManager.linkService.pdfViewer.transUIManager.updateStorageId()
    }
  }

  get fileId() {
    return this._fileId
  }

  inject(manager: TranslationServiceManager, eventBus: PDFEventBus): void {
    this.serverManager = manager
    eventBus.on(PDFViewerEvent.DocumentInit, ({ source }: { source: any }) => {
      this.maxPage = source.numPages
      this.batchGetData.updateMaxPage(this.maxPage)
    })
    eventBus.on(PDFViewerEvent.PagesDestroy, () => {
      this.batchGetData.destroy()
    })
  }

  private serializeParagraphs(paragraphs: Paragraph[]) {
    return paragraphs.reduce(
      (acc, paragraph, index) => {
        acc[index] = paragraph
        return acc
      },
      {} as Record<string, Paragraph>,
    )
  }

  private deserializeParagraphs(paragraphs: Record<string, Paragraph> | null) {
    if (!paragraphs) {
      return []
    }
    const newParagraphs: Paragraph[] = []
    for (const [index, paragraph] of Object.entries(paragraphs)) {
      if (+index < 0) {
        continue
      }
      newParagraphs[+index] = paragraph
    }
    return newParagraphs
  }

  async update(
    pageNumber: number,
    payload: {
      id: string
      index: number
      paragraph: Paragraph
      version: string
    },
  ) {
    try {
      // 获取或创建该文件的存储
      if (!localStorageMap.has(payload.id)) {
        localStorageMap.set(payload.id, new Map())
      }
      const fileStorage = localStorageMap.get(payload.id)!

      // 获取现有页面数据或创建新的
      const existingData = fileStorage.get(pageNumber) || {
        version: payload.version,
        block_data: {},
      }

      // 更新指定的段落
      existingData.block_data[payload.index] = payload.paragraph
      existingData.version = payload.version

      // 保存回存储
      fileStorage.set(pageNumber, existingData)

      return { isError: false, data: null, message: '' }
    } catch (error) {
      return { isError: true, data: null, message: 'Update failed' }
    }
  }

  async get(pageNumber: number, id: string) {
    const result = await this.batchGetData.get(pageNumber, id)
    if (!result.data) {
      return {
        ...result,
        data: null,
      }
    }
    const { block_data, ...restData } = result.data!
    return {
      ...result,
      data: {
        ...restData,
        paragraphs: this.deserializeParagraphs(block_data),
      },
    }
  }

  async save(
    pageNumber: number,
    payload: { paragraphs: Paragraph[]; version: string; id: string },
  ) {
    const { paragraphs, version, id } = payload
    this.batchSaveData.save(id, pageNumber, {
      version,
      block_data: this.serializeParagraphs(paragraphs),
    })
    return { isError: false, data: null, message: '' }
  }
}
