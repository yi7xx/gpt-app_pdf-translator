import ConcurrentPromise from './ConcurrentPromise'

class GoogleHelper {
  static get googleTranslateTKK() {
    return '448487.932609646'
  }

  static shiftLeftOrRightThenSumOrXor(num: number, optString: string): number {
    for (let i = 0; i < optString.length - 2; i += 3) {
      /** @type {string|number} */
      let acc: number | string = optString.charAt(i + 2)
      if ('a' <= acc) {
        acc = acc.charCodeAt(0) - 87
      } else {
        acc = Number(acc)
      }
      if (optString.charAt(i + 1) == '+') {
        acc = num >>> acc
      } else {
        acc = num << acc
      }
      if (optString.charAt(i) == '+') {
        num += acc & 4294967295
      } else {
        num ^= acc
      }
    }
    return num
  }

  static transformQuery(query: string): Array<number> {
    const bytesArray: Array<number> = []
    let idx = 0
    for (let i = 0; i < query.length; i++) {
      let charCode = query.charCodeAt(i)

      if (128 > charCode) {
        bytesArray[idx++] = charCode
      } else {
        if (2048 > charCode) {
          bytesArray[idx++] = (charCode >> 6) | 192
        } else {
          if (
            55296 == (charCode & 64512) &&
            i + 1 < query.length &&
            56320 == (query.charCodeAt(i + 1) & 64512)
          ) {
            charCode =
              65536 + ((charCode & 1023) << 10) + (query.charCodeAt(++i) & 1023)
            bytesArray[idx++] = (charCode >> 18) | 240
            bytesArray[idx++] = ((charCode >> 12) & 63) | 128
          } else {
            bytesArray[idx++] = (charCode >> 12) | 224
          }
          bytesArray[idx++] = ((charCode >> 6) & 63) | 128
        }
        bytesArray[idx++] = (charCode & 63) | 128
      }
    }
    return bytesArray
  }

  /**
   * Calculates the hash (TK) of a query for google translator.
   */
  static calcHash(query: string): string {
    const windowTkk = GoogleHelper.googleTranslateTKK
    const tkkSplited = windowTkk.split('.')
    const tkkIndex = Number(tkkSplited[0]) || 0
    const tkkKey = Number(tkkSplited[1]) || 0

    const bytesArray = GoogleHelper.transformQuery(query)

    let encondingRound = tkkIndex
    for (const item of bytesArray) {
      encondingRound += item
      encondingRound = GoogleHelper.shiftLeftOrRightThenSumOrXor(
        encondingRound,
        '+-a^+6',
      )
    }
    encondingRound = GoogleHelper.shiftLeftOrRightThenSumOrXor(
      encondingRound,
      '+-3^+b+-f',
    )

    encondingRound ^= tkkKey
    if (encondingRound <= 0) {
      encondingRound = (encondingRound & 2147483647) + 2147483648
    }

    const normalizedResult = encondingRound % 1000000
    return normalizedResult.toString() + '.' + (normalizedResult ^ tkkIndex)
  }
}

/**
 * HTML 实体和特殊字符处理工具类
 */
class HTMLEntityHelper {
  // 常用 HTML 实体映射表
  private static readonly entities: Record<string, string> = {
    // 基本实体
    '&#39;': "'",
    '&#x27;': "'",
    '&quot;': '"',
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',

    // 扩展实体
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&cent;': '¢',
    '&pound;': '£',
    '&euro;': '€',
    '&yen;': '¥',
    '&sect;': '§',
    '&times;': '×',
    '&divide;': '÷',
    '&plusmn;': '±',

    // 常见标点符号
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&lsquo;': "'",
    '&rsquo;': "'",
    '&hellip;': '…',
    '&mdash;': '—',
    '&ndash;': '–',

    // 数学符号
    '&plus;': '+',
    '&minus;': '−',
    '&equals;': '=',
    '&le;': '≤',
    '&ge;': '≥',
    '&ne;': '≠',
    '&asymp;': '≈',

    // 货币符号
    '&curren;': '¤',
    '&dollar;': '$',

    // 常用符号
    '&deg;': '°',
    '&prime;': '′',
    '&Prime;': '″',
    '&micro;': 'µ',
    '&para;': '¶',
    '&middot;': '·',
    '&bull;': '•',
    '&spades;': '♠',
    '&hearts;': '♥',
    '&diams;': '♦',
    '&clubs;': '♣',

    // 箭头
    '&larr;': '←',
    '&uarr;': '↑',
    '&rarr;': '→',
    '&darr;': '↓',
    '&harr;': '↔',

    // 空格
    '&nbsp;': ' ',
    '&ensp;': ' ',
    '&emsp;': ' ',
    '&thinsp;': ' ',

    // 其他常用符号
    '&iexcl;': '¡',
    '&iquest;': '¿',
    '&dagger;': '†',
    '&Dagger;': '‡',
  }

  // 需要转义的特殊字符正则
  private static readonly specialCharsRegex = /[&<>"']/g

  // HTML 标签正则
  private static readonly htmlTagRegex = /<[^>]+>/g

  // 实体正则
  private static readonly entityRegex = /&[#\w]+;/g

  /**
   * 解码数字形式的 HTML 实体
   */
  private static decodeNumericEntity(entity: string): string {
    // 处理十进制
    const decimalMatch = entity.match(/^&#(\d+);$/)
    if (decimalMatch) {
      const code = parseInt(decimalMatch[1]!, 10)
      return this.isValidCharCode(code) ? String.fromCharCode(code) : entity
    }

    // 处理十六进制
    const hexMatch = entity.match(/^&#x([0-9a-f]+);$/i)
    if (hexMatch) {
      const code = parseInt(hexMatch[1]!, 16)
      return this.isValidCharCode(code) ? String.fromCharCode(code) : entity
    }

    return entity
  }

  /**
   * 检查字符码是否有效
   */
  private static isValidCharCode(code: number): boolean {
    return code >= 0x20 && code <= 0x10ffff
  }

  /**
   * 解码单个 HTML 实体
   */
  private static decodeSingleEntity(entity: string): string {
    // 检查预定义实体
    if (entity in this.entities) {
      return this.entities[entity] as string
    }

    // 处理数字实体
    if (entity.startsWith('&#')) {
      return this.decodeNumericEntity(entity)
    }

    return entity
  }

  /**
   * 解码文本中的所有 HTML 实体
   */
  static decode(text: string): string {
    if (!text || typeof text !== 'string') {
      return text
    }

    return text.replace(this.entityRegex, (entity) => {
      return this.decodeSingleEntity(entity)
    })
  }

  /**
   * 编码特殊字符为 HTML 实体
   */
  static encode(text: string): string {
    if (!text || typeof text !== 'string') {
      return text
    }

    return text.replace(this.specialCharsRegex, (char) => {
      switch (char) {
        case '&':
          return '&amp;'
        case '<':
          return '&lt;'
        case '>':
          return '&gt;'
        case '"':
          return '&quot;'
        case "'":
          return '&#39;'
        default:
          return char
      }
    })
  }

  /**
   * 编码所有可能的字符为 HTML 实体
   */
  static encodeAll(text: string): string {
    if (!text || typeof text !== 'string') {
      return text
    }
    const reverseEntities = Object.fromEntries(
      Object.entries(this.entities).map(([entity, char]) => [char, entity]),
    )
    return text
      .split('')
      .map((char) => {
        return reverseEntities[char] || char
      })
      .join('')
  }

  /**
   * 移除 HTML 标签
   */
  static stripTags(text: string): string {
    if (!text || typeof text !== 'string') {
      return text
    }
    return text.replace(this.htmlTagRegex, '')
  }

  /**
   * 完整的文本清理
   * @param options 清理选项
   */
  static sanitize(
    text: string,
    options: {
      decodeEntities?: boolean
      stripTags?: boolean
      normalizeWhitespace?: boolean
      trim?: boolean
      encodeSpecialChars?: boolean
    } = {},
  ): string {
    if (!text || typeof text !== 'string') {
      return text
    }

    const {
      decodeEntities = true,
      stripTags = true,
      normalizeWhitespace = true,
      trim = true,
      encodeSpecialChars = false,
    } = options

    let result = text

    if (decodeEntities) {
      result = this.decode(result)
    }

    if (stripTags) {
      result = this.stripTags(result)
    }

    if (normalizeWhitespace) {
      result = result.replace(/\s+/g, ' ')
    }

    if (trim) {
      result = result.trim()
    }

    if (encodeSpecialChars) {
      result = this.encode(result)
    }

    return result
  }

  /**
   * 检查文本是否包含 HTML 实体
   */
  static hasEntities(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false
    }
    return this.entityRegex.test(text)
  }

  /**
   * 检查文本是否包含 HTML 标签
   */
  static hasTags(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false
    }
    return this.htmlTagRegex.test(text)
  }

  /**
   * 转义正则表达式特殊字符
   */
  static escapeRegExp(text: string): string {
    if (!text || typeof text !== 'string') {
      return text
    }
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * 统计文本中的实体数量
   */
  static countEntities(text: string): number {
    if (!text || typeof text !== 'string') {
      return 0
    }
    const matches = text.match(this.entityRegex)
    return matches ? matches.length : 0
  }

  /**
   * 获取文本中所有的 HTML 实体
   */
  static getEntities(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return []
    }
    return text.match(this.entityRegex) || []
  }

  /**
   * 验证文本是否包含有效的 HTML 实体
   */
  static validateEntities(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return true
    }
    const entities = this.getEntities(text)
    return entities.every((entity) => {
      // 检查是否是预定义实体
      if (entity in this.entities) {
        return true
      }
      // 检查是否是有效的数字实体
      if (entity.startsWith('&#')) {
        const decoded = this.decodeNumericEntity(entity)
        return decoded !== entity
      }
      return false
    })
  }

  /**
   * 检查字符串是否为有效的 HTML 实体
   */
  static isValidEntity(entity: string): boolean {
    if (!entity || typeof entity !== 'string') {
      return false
    }
    return (
      entity in this.entities ||
      /^&#\d+;$/.test(entity) ||
      /^&#x[0-9a-f]+;$/i.test(entity)
    )
  }
}

const GOOGLE_URL = 'https://translate.googleapis.com/translate_a/t'

class GoogleTranslatorCore {
  private anno = 3
  private client = 'te'
  private v = 3.0
  private format = 'html'
  private concurrentPromise: ConcurrentPromise

  constructor() {
    this.concurrentPromise = new ConcurrentPromise(15)
  }

  //生成URL
  private generateUrl(fromLang: string, toLang: string, text: string) {
    const searchParams = new URLSearchParams()
    searchParams.set('format', this.format)
    searchParams.set('anno', `${this.anno}`)
    searchParams.set('client', this.client)
    searchParams.set('v', `${this.v}`)
    searchParams.set('tk', GoogleHelper.calcHash(text))
    searchParams.set('sl', fromLang)
    searchParams.set('tl', toLang)
    return `${GOOGLE_URL}?${searchParams.toString()}`
  }

  private generateBody(text: string) {
    return `&q=${encodeURIComponent(text)}`
  }

  private transformResponse(result: any): string[] {
    let resultText = ''
    if (Array.isArray(result)) {
      resultText = result[0]?.[0] || ''
    } else if (typeof result === 'string') {
      resultText = result
    } else {
      resultText = String(result)
    }
    return [resultText]
  }

  private async translate(fromLang: string, toLang: string, text: string) {
    const url = this.generateUrl(fromLang, toLang, text)

    const hasTag = HTMLEntityHelper.hasTags(text)

    const body = this.generateBody(text)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      })
      const data = await response.json()
      const result = this.transformResponse(data)
      return {
        isError: false,
        data: [
          HTMLEntityHelper.sanitize(result[0]!, {
            stripTags: !hasTag,
          }),
        ],
        message: '',
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
      return { isError: true, data: [], message: errorMessage }
    }
  }

  // ================================ 暴露方法 ================================
  public async fetchTranslate(
    fromLang: string,
    toLang: string,
    texts: string[],
  ): Promise<{ isError: boolean; data: string[]; message: string }> {
    const batchFetch = this.concurrentPromise.runBatch(
      texts.map((text) => () => this.translate(fromLang, toLang, text)),
    )
    const promises = batchFetch.map((v) => v.promise)
    const result: string[] = []
    await Promise.allSettled(promises).then((res) => {
      res.forEach((item) => {
        if (item.status === 'fulfilled') {
          result.push(item.value.data[0]!)
        } else if (item.status === 'rejected') {
          result.push(null as any)
        }
      })
    })
    return {
      isError: result.some((v) => v === null),
      data: result,
      message: '',
    }
  }
}

export const googleCore = new GoogleTranslatorCore()
