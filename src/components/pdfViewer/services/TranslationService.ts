import type { PDFEventBus } from '../events'
import {
  type Paragraph,
  type TranslationState,
} from '../modules/PDFTransViewerUIManager'
import { ConcurrencyController } from '../utils/concurrencyController'
import {
  TranslationServiceManager,
  type TranslateResult,
} from './TranslationServiceManager'

export enum TranslateType {
  // 免费服务
  FREE = 'free',
  // 基础服务
  BASIC = 'basic',
  // 高级服务
  ADVANCED = 'advanced',
  // 通用自定服务, 通用服务需要传入分类
  Custom = 'custom',
}

/**
 * 翻译选项
 */
export interface TranslateOption {
  type: TranslateType
  name: string
  // 翻译名称，用于显示，自定义的优先级高于name
  displayName?: string
  icon: React.ReactNode
  // 分类
  // 分类的名称，用于显示，自定义的优先级高于type
  category?: string
  // 分类的名称，用于UI显示
  categoryDisplayname?: string
  // 是否支持全局翻译 默认支持
  enableFullText?: boolean
  // 是否支持单行翻译，默认支持
  enableSingleLine?: boolean
  // 暂时不用
  toolTip?: string
  [key: string]: any
}

/**
 * 翻译参数
 */
export interface TranslateParams {
  text: string
  fromLang: string
  toLang: string
  options: TranslateOption
  showTooltip?: boolean
  cancel: () => void
  pageNumber: number
  [key: string]: any
}

/**
 * 批量翻译参数
 */
export interface BatchTranslateParams {
  texts: string[]
  fromLang: string
  toLang: string
  signal: AbortSignal
  cancel: () => void
  pageNumber: number
  options: TranslateOption
  [key: string]: any
}

export interface PrintTranslateParams extends BatchTranslateParams {
  printTask: PrintTranslateTask
}

export type PrintTranslateTask<T = string[] | null> = (
  pageNumber: number,
  callback: () => Promise<TranslateResult<T>>,
) => Promise<TranslateResult<T>>

/**
 * 翻译服务
 */
export abstract class TranslationService {
  public name: string
  // 是否为流式翻译
  public stream: boolean
  public printController: ConcurrencyController
  public printMaxConcurrency: number
  public printPromiseMap = new Map<number, string>()
  constructor(
    name: string,
    stream: boolean = false,
    printMaxConcurrency: number = 1,
  ) {
    this.name = name
    this.stream = stream
    this.printMaxConcurrency = printMaxConcurrency
    this.printController = this.getConcurrencyController(printMaxConcurrency)
  }

  abstract inject(
    manager: TranslationServiceManager,
    eventBus: PDFEventBus,
  ): void

  abstract get options(): TranslateOption[]

  abstract translate(
    params: TranslateParams,
  ): Promise<TranslateResult<string | Response | null>>
  // 批量翻译
  abstract batchTranslate(
    params: BatchTranslateParams,
  ): Promise<TranslateResult<string[] | Response | null>>

  abstract printTranslate(
    params: PrintTranslateParams,
  ): Promise<TranslateResult<string[] | Response | null>>

  /**
   * 提前解决任务调度
   */
  presetTaskResult<T>(pageNumber: number, data: T) {
    if (!this.printPromiseMap.has(pageNumber)) {
      return
    }
    const taskId = this.printPromiseMap.get(pageNumber)!
    this.printPromiseMap.delete(pageNumber)
    this.printController.presetTaskResult(taskId, data)
  }

  public async parseStream(
    response: Response,
    callback: (texts: string[], done?: boolean) => void,
    errorCallback: (error: { message: string; showTooltip: boolean }) => void,
  ) {
    throw new Error('Not implemented')
  }
  // 重试机制
  public withRetry<T>(
    fn: (...args: any[]) => Promise<TranslateResult<T>>,
    retry = 3,
    delay = 1000,
  ) {
    return async (...args: any[]) => {
      let lastErrorMessage = 'translate failed'

      for (let i = 0; i < retry; i++) {
        try {
          const result = await fn(...args)
          if (!result.isError) {
            return result
          }
          // 保存最后一次错误消息
          lastErrorMessage = result.message || lastErrorMessage

          if (i < retry - 1) {
            // 每次重试等待时间
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
        } catch (error) {
          // 处理网络错误
          let errorMessage = 'translate failed'

          // 检查是否为网络错误
          if (error instanceof TypeError || error instanceof DOMException) {
            errorMessage = 'network error, please check your connection'
          } else if (error instanceof Error) {
            // 其他类型的错误，保留错误信息
            errorMessage = error.message || 'translate failed'
          }

          // 保存最后一次错误消息
          lastErrorMessage = errorMessage

          if (i === retry - 1) {
            return { isError: true, data: null, message: errorMessage }
          }

          // 继续重试
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }

      // 返回最后一次失败的具体错误信息
      return {
        isError: true,
        data: null,
        message: lastErrorMessage,
      }
    }
  }

  public getConcurrencyController(maxConcurrency: number) {
    return new ConcurrencyController(maxConcurrency)
  }

  destroy() {
    this.printController.cancelAll()
    this.printPromiseMap.clear()
  }
}

/**
 * 翻译存储结果
 */
export type TranslationStorageResult = TranslateResult<
  Omit<TranslationState, 'status' | 'needOCR' | 'message'>
>

/**
 * 翻译存储服务
 */
export abstract class TranslationStorageService {
  abstract id: string
  abstract inject(
    manager: TranslationServiceManager,
    eventBus: PDFEventBus,
  ): void
  // 获取翻译
  abstract get(
    pageNumber: number,
    id: string,
  ): Promise<TranslationStorageResult>
  // 全量保存
  abstract save(
    pageNumber: number,
    payload: {
      id: string
      paragraphs: Paragraph[]
      version: string
    },
  ): Promise<TranslateResult<void>>
  // 增量保存
  abstract update(
    pageNumber: number,
    payload: {
      id: string
      index: number
      paragraph: Paragraph
      version: string
    },
  ): Promise<TranslateResult<void>>
}

export interface OCRParams {
  file: Blob
  pageNumber: number
  width: number
  height: number
  scale: number
  paragraphs: Paragraph[]
  cancel: () => void
  signal: AbortSignal
}

export interface OCRResult {
  data: {
    paragraphs: Paragraph[]
    pageNumber: number
  }
  isError: boolean
  message?: string
}

/**
 * ocr 服务
 */
export abstract class OCRService {
  abstract inject(
    manager: TranslationServiceManager,
    eventBus: PDFEventBus,
  ): void
  abstract ocr(params: OCRParams): Promise<OCRResult>
}
