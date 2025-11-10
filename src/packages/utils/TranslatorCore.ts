import { bingCore } from './BingTranslatorCore'
import { googleCore } from './GoogleTranslatorCore'

interface TranslatorCoreOptions {
  retryTimes?: number
  // 每次重试的间隔时间
  retryInterval?: number
  // bing 重试次数
  bingRetryTimes?: number
  // bing 重试间隔时间
  bingRetryInterval?: number
  // google 重试次数
  googleRetryTimes?: number
  // google 重试间隔时间
  googleRetryInterval?: number
}

class TranslatorCore {
  private googleCore = googleCore
  private bingCore = bingCore
  private options: Required<TranslatorCoreOptions>

  constructor(options?: TranslatorCoreOptions) {
    const defaultOptions = {
      retryTimes: options?.retryTimes ?? 3,
      retryInterval: options?.retryInterval ?? 1000,
      bingRetryTimes: options?.retryTimes ?? 3,
      bingRetryInterval: options?.retryInterval ?? 1000,
      googleRetryTimes: options?.retryTimes ?? 3,
      googleRetryInterval: options?.retryInterval ?? 1000,
    }
    this.options = defaultOptions as Required<TranslatorCoreOptions>
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private withRetry<T>(
    fn: (
      ...args: any[]
    ) => Promise<{ isError: boolean; data: T; message: string }>,
    retryTimes = this.options.retryTimes,
    retryInterval = this.options.retryInterval,
  ) {
    const retry = async (...args: any[]) => {
      for (let i = 0; i < retryTimes; i++) {
        const res = await fn(...args)
        if (!res.isError) {
          return res
        }
        await this.sleep(retryInterval)
      }
      return { isError: true, data: [] as T, message: 'translate failed' }
    }
    return retry
  }

  // ================================ 暴露方法 ================================
  async translateBing(fromLang: string, toLang: string, texts: string[]) {
    return this.withRetry(
      this.bingCore.fetchTranslate.bind(this.bingCore),
      this.options.bingRetryTimes,
      this.options.bingRetryInterval,
    )(fromLang, toLang, texts)
  }

  async translateGoogle(fromLang: string, toLang: string, texts: string[]) {
    return this.withRetry(
      this.googleCore.fetchTranslate.bind(this.googleCore),
      this.options.googleRetryTimes,
      this.options.googleRetryInterval,
    )(fromLang, toLang, texts)
  }

  /**
   * 默认使用google翻译，兜底使用微软翻译
   */
  async translate(fromLang: string, toLang: string, texts: string[]) {
    const res = await this.translateBing(fromLang, toLang, texts)
    const { isError } = res
    if (!isError) {
      return res
    }
    return this.translateGoogle(fromLang, toLang, texts)
  }
}

export default TranslatorCore
