import { safeStorage } from '@sider/utils/safeStorage'

const URL = 'https://api-edge.cognitive.microsofttranslator.com/translate'
const AUTH_URL = 'https://edge.microsoft.com/translate/auth'
const CACHE_KEY = '___BING_TOKEN___'
const RETRY_COUNT = 2

export type BingTranslateResult = {
  detectedLanguage: {
    language: string
    score: number
  }
  translations: {
    text: string
    to: string
  }[]
}[]

export class BingTranslatorCore {
  private token = ''
  private tokenCapability: PromiseWithResolvers<string> | null = null
  private API_VERSION = '3.0'
  private retry: number

  constructor(retry = RETRY_COUNT) {
    this.retry = retry
  }

  private normalizeLocale(code: string) {
    switch (code) {
      case 'zh_CN':
        return 'zh-Hans'
      case 'zh_TW':
        return 'zh-Hant'
      case 'auto':
        return ''
      default:
        return code
    }
  }

  private async getToken(useCache = true) {
    if (useCache) {
      const cacheToke = this.token || safeStorage.getItem(CACHE_KEY)
      if (cacheToke) {
        return cacheToke
      }
    } else {
      if (this.tokenCapability) {
        const token = await Promise.race([
          this.tokenCapability.promise,
          Promise.resolve(''),
        ])
        if (token) {
          this.tokenCapability = null
        }
      }
    }

    if (!this.tokenCapability) {
      this.tokenCapability = Promise.withResolvers<string>()
      try {
        const res = await fetch(AUTH_URL)
        if (!res.ok) {
          this.tokenCapability.resolve('')
          return ''
        }
        const token = await res.text()
        this.tokenCapability.resolve(token)
        safeStorage.setItem(CACHE_KEY, token)
      } catch {
        this.tokenCapability.resolve('')
        return ''
      }
    }
    return this.tokenCapability.promise
  }

  //生成URL
  private generateUrl(fromLang: string, toLang: string) {
    const from = this.normalizeLocale(fromLang)
    const to = this.normalizeLocale(toLang)
    return `${URL}?api-version=${this.API_VERSION}&from=${from}&to=${to}`
  }

  private normalizeData(data: BingTranslateResult) {
    return data.map((item) => item.translations[0]?.text || '')
  }

  // ================================ 暴露方法 ================================
  public async fetchTranslate(
    fromLang: string,
    toLang: string,
    texts: string[],
    // 重试次数
    retry = this.retry,
  ): Promise<{ isError: boolean; data: string[]; message: string }> {
    const token = (this.token = await this.getToken())
    if (!token) {
      return { isError: true, data: [], message: 'Failed to get token' }
    }
    try {
      const url = this.generateUrl(fromLang, toLang)
      const body = texts.map((text) => ({ Text: text }))
      const res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (res.status === 401) {
        this.token = await this.getToken(false)
        return this.fetchTranslate(fromLang, toLang, texts, retry - 1)
      }

      if (!res.ok) {
        return { isError: true, data: [], message: 'translate failed' }
      }
      const data = await res.json()
      return { isError: false, data: this.normalizeData(data), message: '' }
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

      return { isError: true, data: [], message: errorMessage }
    }
  }
}

export const bingCore = new BingTranslatorCore()
