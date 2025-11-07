/* eslint-disable max-lines */
import { type PDFDocumentProxy } from 'pdfjs-dist'
import { type TextItem } from 'pdfjs-dist/types/src/display/api'
import {
  FindEvent,
  FindState,
  type FindTextPayload,
  type PDFEventBus,
} from '../events'
import {
  DIACRITICS_EXCEPTION,
  getCharacterType,
  getOriginalIndex,
  normalize,
} from '../libs/pdfjs-internal'
import { scrollIntoView } from '../utils/ui'
import { LinkService } from './LinkService'

interface PDFFindControllerOptions {
  linkService: LinkService
  eventBus: PDFEventBus
  container: HTMLDivElement
  updateMatchesCountOnProgress?: boolean
}

const FIND_TIMEOUT = 250
const FIND_TIMEOUT_STOP = 1000
// 相识的度
const SIMILARITY_THRESHOLD = 0.3
// 最短匹配长度
const MIN_MATCH_LENGTH = 10
// 最长合并匹配长度
const MAX_MATCH_LENGTH = 100

let DIACRITICS_EXCEPTION_STR

const SPECIAL_CHARS_REG_EXP =
  /([.*+?^${}()|[\]\\])|(\p{P})|(\s+)|(\p{M})|(\p{L})/gu

const NOT_DIACRITIC_FROM_END_REG_EXP = /([^\p{M}])\p{M}*$/u
const NOT_DIACRITIC_FROM_START_REG_EXP = /^\p{M}*([^\p{M}])/u

const SPLIT_RULES = {
  // paragraph: /\n\n+/g,
  // sentence: /(?<=[。？！?!.])\s*/gu,
  punctuation: /[\n,，。；;！？?!…：、`]|(?:\s{2,})/gu,
}

interface MatchItem {
  index: number
  length: number
  similarity: number
  subQuery: string
  subContent: string
}

export class PDFFindController {
  private linkService: LinkService
  private eventBus: PDFEventBus
  private updateMatchesCountOnProgress: boolean
  private pdfDocument: PDFDocumentProxy | null
  private container: HTMLDivElement
  private _state: FindTextPayload | null
  private _previousState: FindTextPayload | null
  private firstPageCapability: PromiseWithResolvers<void>
  private dirtyMatch = false
  private extractTextPromises: Promise<any>[] = []
  private pendingFindMatches = new Set<number>()
  private abortController: AbortController | null = null
  // 是否终止匹配
  private shouldStopMatching = false
  private searchTimeout: NodeJS.Timeout | null = null

  private rawQuery: string | null = null
  private normalizedQuery: string | null = null
  private matchesCountTotal: number = 0

  // 文本内容
  private pageContents: string[] = []
  // 文本的差异化
  private pageDiffs: ([Uint32Array, Int32Array] | null)[] = []
  // 是否包含重音符号
  private hasDiacritics: boolean[] = []
  // 换行符的位置
  private eolPositions: number[][] = []

  private findTimeout: NodeJS.Timeout | null = null
  private _highlightMatches: boolean = false
  private _pageMatches: number[][] = []
  private _pageMatchesLength: number[][] = []
  private _selected = {
    pageIdx: -1,
    // 暂时不需要
    matchIdx: -1,
  }

  constructor({
    linkService,
    eventBus,
    container,
    updateMatchesCountOnProgress = true,
  }: PDFFindControllerOptions) {
    this.linkService = linkService
    this.eventBus = eventBus
    this.updateMatchesCountOnProgress = updateMatchesCountOnProgress
    this.pdfDocument = null
    this._state = null
    this._previousState = null
    this.firstPageCapability = Promise.withResolvers()
    this.abortController = null
    this.container = container
    this.reset()
  }

  get highlightMatches() {
    return this._highlightMatches
  }

  get pageMatches() {
    return this._pageMatches
  }

  get pageMatchesLength() {
    return this._pageMatchesLength
  }

  get state() {
    return this._state
  }

  get selected() {
    return this._selected
  }

  private get query() {
    if (!this.state) return []
    const { query } = this.state
    if (typeof query === 'string') {
      if (query !== this.rawQuery) {
        this.rawQuery = query
        ;[this.normalizedQuery] = normalize(query)
      }
      return this.normalizedQuery!
    }
    return (query || []).filter((q) => !!q).map((q) => normalize(q)[0])
  }

  setDocument(pdfDocument: PDFDocumentProxy | null) {
    if (this.pdfDocument) {
      this.reset()
    }
    this.pdfDocument = pdfDocument
    if (!pdfDocument) {
      return
    }
    this.firstPageCapability.resolve()
  }

  updateContainer(container: HTMLDivElement) {
    this.container = container
  }

  /**
   * 文本转 highlight
   * highlight 查找文本的位置
   */
  async findTextPosition(text: string, pageNumbers: number[]) {
    const { promise, resolve } = Promise.withResolvers<{
      pageNumber: number
      matches: number[]
      matchesLength: number[]
    }>()
    const pdfDocument = this.pdfDocument
    this.firstPageCapability.promise.then(async () => {
      if (!this.pdfDocument || this.pdfDocument !== pdfDocument) {
        return
      }
      for (const pageNumber of pageNumbers) {
        const pageIndex = pageNumber - 1
        this.extractTextByPageNumber(pageNumber)
        await this.extractTextPromises[pageIndex]
        const pageContent = this.pageContents[pageIndex]!
        const matcherResult =
          this.exactMatch(text, pageContent, pageIndex) || []

        // 增加模糊匹配
        if (matcherResult.length === 0) {
          const fuzzyMatchResult = this.fuzzyMatch(text, pageContent, pageIndex)
          if (fuzzyMatchResult) {
            matcherResult.push(...fuzzyMatchResult)
          }
        }

        const matches: number[] = []
        const matchesLength: number[] = []
        const diffs = this.pageDiffs[pageIndex]

        matcherResult.forEach(({ index, length }) => {
          const [matchPos, matchLen] = getOriginalIndex(diffs!, index, length)
          if (matchLen) {
            matches.push(matchPos)
            matchesLength.push(matchLen)
          }
        })

        if (matches.length && matchesLength.length) {
          resolve({ matches, matchesLength, pageNumber })
          return
        }
      }
      // 兜底未匹配到
      resolve({ matches: [], matchesLength: [], pageNumber: pageNumbers[0]! })
    })
    return promise
  }

  private async findText(state?: FindTextPayload) {
    if (!state) {
      return
    }
    const pdfDocument = this.pdfDocument
    if (this._state === null || this.shouldDirtyMatch(state)) {
      this.dirtyMatch = true
    }
    this._previousState = this._state
    this._state = state
    this.firstPageCapability.promise.then(() => {
      if (!this.pdfDocument || this.pdfDocument !== pdfDocument) {
        return
      }
      this.extractTextByPageNumber(state.pageNumber)

      if (this.findTimeout) {
        clearTimeout(this.findTimeout)
        this.findTimeout = null
      }

      this.findTimeout = setTimeout(() => {
        this.nextMatch()
        this.findTimeout = null
      }, FIND_TIMEOUT)
    })
  }

  private findClose() {
    const pdfDocument = this.pdfDocument
    this.firstPageCapability.promise.then(() => {
      if (
        !this.pdfDocument ||
        (pdfDocument && this.pdfDocument !== pdfDocument)
      ) {
        return
      }

      if (this.findTimeout) {
        clearTimeout(this.findTimeout)
        this.findTimeout = null
      }
      this.dirtyMatch = true
      this._state = null
      this._previousState = null
      this.updateUIState(FindState.FOUND)
      this._highlightMatches = false
      this.updateAllPages()
    })
  }

  private nextMatch() {
    if (!this._state) return

    const pageIndex = this._state.pageNumber - 1

    // 标记为高亮匹配
    this._highlightMatches = true

    if (this.dirtyMatch) {
      // 重置状态
      this.dirtyMatch = false
      this._selected.pageIdx = this._selected.matchIdx = -1
      this._pageMatches.length = 0
      this._pageMatchesLength.length = 0
      this.matchesCountTotal = 0

      this.updateAllPages(
        this._previousState ? this._previousState.pageNumber - 1 : undefined,
      )

      if (!this.pendingFindMatches.has(pageIndex)) {
        this.extractTextPromises[pageIndex]?.then(() => {
          this.pendingFindMatches.delete(pageIndex)
          this.calculateMatch(pageIndex)
        })
      }
    }
  }

  private updateMatch(found = false) {
    let state = FindState.NOT_FOUND
    if (found) {
      this._selected.matchIdx = 0
      state = FindState.FOUND
    }
    this.updateUIState(state, this.state?.findPrevious)
    if (this._selected.pageIdx !== -1) {
      this.updatePage(this._selected.pageIdx)
    }
  }

  private startStopMatching() {
    this.searchTimeout = setTimeout(() => {
      this.shouldStopMatching = true
      this.searchTimeout = null
    }, FIND_TIMEOUT_STOP)
  }

  private cancelStopMatching() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout)
      this.searchTimeout = null
    }
  }

  private calculateMatch(pageIndex: number) {
    const query = this.query
    if (query.length === 0) {
      return
    }
    const pageContent = this.pageContents[pageIndex]!
    this.shouldStopMatching = false
    this.startStopMatching()
    // 计算匹配时间
    const start = performance.now()
    let matcher = ''

    const matcherResult = []
    const exactMatch = this.state?.parallel || !this.state?.fuzzyMatch
    const fuzzyMatch = this.state?.parallel || this.state?.fuzzyMatch
    if (exactMatch) {
      const exactMatchResult = this.exactMatch(query, pageContent, pageIndex)
      if (exactMatchResult) {
        matcherResult.push(...exactMatchResult)
        matcher = 'exactMatch'
      }
    }
    if (fuzzyMatch && matcherResult.length === 0) {
      const fuzzyMatchResult = this.fuzzyMatch(query, pageContent, pageIndex)
      if (fuzzyMatchResult) {
        matcherResult.push(...fuzzyMatchResult)
        matcher = 'fuzzyMatch'
      }
    }
    // 计算匹配时间
    const end = performance.now()
    console.log(`${query}, ${pageContent}, ${end - start}ms ${matcher}`)

    this.cancelStopMatching()
    const matches: number[] = (this.pageMatches[pageIndex] = [])
    const matchesLength: number[] = (this.pageMatchesLength[pageIndex] = [])
    const diffs = this.pageDiffs[pageIndex]

    matcherResult?.forEach(({ index, length }) => {
      const [matchPos, matchLen] = getOriginalIndex(diffs!, index, length)
      if (matchLen) {
        matches.push(matchPos)
        matchesLength.push(matchLen)
      }
    })
    // 是否高亮所有匹配
    // if (this.state?.highlightAll) {
    //   this.updatePage(pageIndex)
    // }
    const pageMatchesCount = matches.length
    this.matchesCountTotal += pageMatchesCount
    if (this.updateMatchesCountOnProgress) {
      if (pageMatchesCount > 0) {
        this.updateUIResultCount()
      }
    }

    if (matches.length > 0) {
      this._selected.pageIdx = pageIndex
    }

    // 未匹配到跳转到对应的页码
    if (matches.length === 0) {
      this.linkService.goToPage(pageIndex + 1)
    }

    this.matchesReady(this.pageMatches[pageIndex]!)
  }

  private updateUIResultCount() {
    this.eventBus.emit(FindEvent.UpdateFindMatchesCount, {
      source: this,
      matchesCount: this.requestMatchesCount(),
    })
  }

  private updateAllPages(previousPageIndex?: number) {
    this.eventBus.emit(FindEvent.UpdateTextLayerMatches, {
      source: this,
      pageIndex: -1,
      previousPageIndex,
    })
  }

  private updatePage(pageIndex: number) {
    if (this._selected.pageIdx === pageIndex) {
      // this.linkService.setAndLoadPage(pageIndex + 1)
      this.linkService.page = pageIndex + 1
    }

    this.eventBus.emit(FindEvent.UpdateTextLayerMatches, {
      source: this,
      pageIndex,
      previousPageIndex: this._previousState
        ? this._previousState.pageNumber - 1
        : undefined,
    })
  }
  /**
   * 精确匹配
   */
  private exactMatch(
    query: string | string[],
    pageContent: string,
    pageIndex: number,
    state: FindTextPayload | null | undefined = this.state,
  ) {
    const hasDiacritics = this.hasDiacritics[pageIndex] ?? false
    let isUnicode = false
    if (typeof query === 'string') {
      ;[isUnicode, query] = this.convertToRegExpString(
        query,
        hasDiacritics,
        state,
      )
    } else {
      query = query
        .sort()
        .reverse()
        .map((q) => {
          const [isUnicodePart, queryPart] = this.convertToRegExpString(
            q,
            hasDiacritics,
            state,
          )
          isUnicode ||= isUnicodePart
          return `(${queryPart})`
        })
        .join('|')
    }
    if (!query) {
      // 查询可能为空，因为一些字符(如变音符号)可能已被剔除
      return undefined
    }

    const { caseSensitive = false, entireWord = false } = state || {}
    const flags = `g${isUnicode ? 'u' : ''}${caseSensitive ? '' : 'i'}`
    const regExp = new RegExp(query, flags)
    const matches: { index: number; length: number }[] = []
    let match
    try {
      while ((match = regExp.exec(pageContent)) !== null) {
        if (
          entireWord &&
          !this.isEntireWord(pageContent, match.index, match[0].length)
        ) {
          continue
        }
        matches.push({ index: match.index, length: match[0].length })
      }
    } catch (error) {
      console.error('findText error', error)
      console.log(['query', query, 'pageContent', pageContent])
    }
    return matches
  }

  /**
   * 模糊匹配
   */
  private fuzzyMatch(
    query: string | string[],
    pageContent: string,
    pageIndex: number,
  ) {
    const subQueries = this.splitQuery(query, SPLIT_RULES.punctuation)
    const subContents = this.splitStringWithPosition(
      pageContent,
      SPLIT_RULES.punctuation,
      pageIndex,
    )
    const matches: MatchItem[] = []
    outLoop: for (const subQuery of subQueries) {
      const similarities: MatchItem[] = []
      for (const subContent of subContents) {
        if (this.shouldStopMatching) {
          break outLoop
        }
        const similarity = this.calculateStringSimilarity(
          subQuery,
          subContent.content,
        )
        if (similarity > SIMILARITY_THRESHOLD) {
          similarities.push({
            similarity,
            subQuery: subQuery,
            subContent: subContent.content,
            index: subContent.start,
            length: subContent.content.length,
          })
        }
        if (similarity === 1) {
          break
        }
      }
      if (similarities.length === 0) {
        continue
      }
      const maxSimilarity = similarities.reduce((pre, cur) => {
        return pre.similarity > cur.similarity ? pre : cur
      }, similarities[0]!)
      matches.push(maxSimilarity)
    }
    return this.mergeMatches(matches, pageContent, SPLIT_RULES.punctuation)
  }

  /**
   * 合并匹配项
   */
  private mergeMatches(
    matches: Array<{
      similarity: number
      subQuery: string
      subContent: string
      index: number
      length: number
    }>,
    pageContent: string,
    regExp: RegExp,
  ) {
    matches.sort((a, b) => a.index - b.index)
    const flags = regExp.flags.replace('g', '')
    regExp = new RegExp(regExp.source, flags)

    const mergedMatches: typeof matches = []
    let currentMatch = matches[0]!

    if (!currentMatch) return []

    for (let i = 1; i < matches.length; i++) {
      const nextMatch = matches[i]!

      // 检查是否存在重叠
      const hasOverlap =
        currentMatch.index + currentMatch.length > nextMatch.index

      if (hasOverlap) {
        // 如果存在重叠，选择相似度更高的匹配项
        if (nextMatch.similarity > currentMatch.similarity) {
          currentMatch = nextMatch
        }
        continue
      }
      // 检查间隔是否只包含标点符号
      const intervalStr = pageContent.slice(
        currentMatch.index + currentMatch.length,
        nextMatch.index,
      )
      const isStrictlyPunctuation =
        intervalStr &&
        intervalStr
          .split(/\s|/)
          .filter((char) => char !== '')
          .every((char) => regExp.test(char))

      if (isStrictlyPunctuation) {
        // 合并匹配项
        currentMatch = {
          ...currentMatch,
          length: nextMatch.index + nextMatch.length - currentMatch.index,
          subContent: pageContent.slice(
            currentMatch.index,
            nextMatch.index + nextMatch.length,
          ),
        }
      } else {
        mergedMatches.push(currentMatch)
        currentMatch = nextMatch
      }
    }

    mergedMatches.push(currentMatch)

    return mergedMatches
  }
  /**
   * 计算字符串相似度
   */
  private calculateStringSimilarity(query: string, target: string): number {
    if (!query.length && !target.length) {
      return 1
    }
    if (!query.length || !target.length) {
      return 0
    }
    // 编辑距离（Levenshtein Distance）的计算（滚动数组）
    const dp = Array(query.length + 1)
      .fill(0)
      .map(() => Array(2).fill(0))

    for (let i = 0; i <= query.length; i++) {
      dp[i]![0] = i
    }

    for (let j = 1; j <= target.length; j++) {
      dp[0]![j % 2] = j
      for (let i = 1; i <= query.length; i++) {
        if (query[i - 1] === target[j - 1]) {
          dp[i]![j % 2] = dp[i - 1]![(j - 1) % 2]
        } else {
          dp[i]![j % 2] =
            Math.min(
              dp[i - 1]![(j - 1) % 2],
              dp[i - 1]![j % 2],
              dp[i]![(j - 1) % 2],
            ) + 1
        }
      }
    }
    const editDistance = dp[query.length]![target.length % 2]

    // 转换为相似度
    const maxLen = Math.max(query.length, target.length)
    const similarity = 1 - editDistance / maxLen

    // 保证相似度范围在 [0, 1] 内（避免小数计算导致的边界误差）
    return Math.max(0, Math.min(1, similarity))
  }

  /**
   * 分割query字符串
   */
  private splitQuery(query: string | string[], regExp: RegExp) {
    query = Array.isArray(query) ? query : [query]
    // 过滤空字符串
    return query
      .map((q) => q.split(regExp))
      .flatMap((arr) => arr.filter((q) => q.trim() !== ''))
  }

  /**
   * 分割字符串并返回位置信息
   */
  private splitStringWithPosition(
    pageContent: string,
    regExp: RegExp,
    pageIndex: number,
  ) {
    type TextSegment = { content: string; start: number; end: number }
    const parts: TextSegment[] = []
    const strSplit = this.splitStringByEolPositions(
      pageContent,
      this.eolPositions[pageIndex] || [],
    )

    function createTextSegment(
      rawContent: string,
      startPosition: number,
      start: number,
    ) {
      const trimmedContent = rawContent.trim()
      if (!trimmedContent) {
        return
      }
      const contentStart =
        start + startPosition + rawContent.indexOf(trimmedContent)
      return {
        content: trimmedContent,
        start: contentStart,
        end: contentStart + trimmedContent.length - 1,
      }
    }
    // 合并短文本
    function mergeShortText(contentParts: TextSegment[]) {
      if (contentParts.length <= 1) return contentParts
      const result: TextSegment[] = []
      let current = contentParts[0]!
      for (let i = 1; i < contentParts.length; i++) {
        const next = contentParts[i]!
        if (
          next.end - current.start <= MIN_MATCH_LENGTH &&
          next.end - current.start <= MAX_MATCH_LENGTH
        ) {
          current.end = next.end
          current.content = pageContent.slice(current.start, current.end + 1)
        } else {
          result.push(current)
          current = next
        }
      }
      result.push(current)
      return result
    }

    strSplit.forEach(({ start, content }) => {
      const matches = [...content.matchAll(regExp)]
      let splitStart = 0
      const contentParts: TextSegment[] = []

      matches.forEach((match) => {
        const matchStart = match.index
        const matchLength = match[0].length

        if (splitStart < matchStart) {
          const rawContent = content.slice(splitStart, matchStart)
          const textSegment = createTextSegment(rawContent, splitStart, start)
          if (textSegment) {
            contentParts.push(textSegment)
          }
        }

        splitStart = matchStart + matchLength
      })

      if (splitStart < content.length) {
        const rawContent = content.slice(splitStart)
        const textSegment = createTextSegment(rawContent, splitStart, start)
        if (textSegment) {
          contentParts.push(textSegment)
        }
      }
      // 处理短文本进行合并
      parts.push(...mergeShortText(contentParts))
    })
    return parts
  }

  /**
   * 通过比较第一个/最后一个字符类型与前/后字符类型，
   * 判断搜索查询是否构成"整词"。
   */
  private isEntireWord(content: string, startIdx: number, length: number) {
    let match = content.slice(0, startIdx).match(NOT_DIACRITIC_FROM_END_REG_EXP)
    if (match) {
      const first = content.charCodeAt(startIdx)
      const limit = match[1]!.charCodeAt(0)
      if (getCharacterType(first) === getCharacterType(limit)) {
        return false
      }
    }
    match = content
      .slice(startIdx + length)
      .match(NOT_DIACRITIC_FROM_START_REG_EXP)
    if (match) {
      const last = content.charCodeAt(startIdx + length - 1)
      const limit = match[1]!.charCodeAt(0)
      if (getCharacterType(last) === getCharacterType(limit)) {
        return false
      }
    }

    return true
  }

  private convertToRegExpString(
    query: string,
    hasDiacritics: boolean,
    state?: FindTextPayload | null,
  ) {
    // 从当前状态中获取是否需要匹配变音符号的标志
    const { matchDiacritics = false } = state || {}
    let isUnicode = false // 标记是否需要使用 Unicode 模式

    // 使用正则表达式替换特殊字符、标点符号、空格、变音符号和字母
    query = query.replaceAll(
      SPECIAL_CHARS_REG_EXP,
      (
        match,
        p1 /* 转义字符 */,
        p2 /* 标点符号 */,
        p3 /* 空格 */,
        p4 /* 变音符号 */,
        p5 /* 字母 */,
      ) => {
        if (p1) {
          return `[ ]*\\${p1}[ ]*`
        }
        if (p2) {
          return `[ ]*${p2}[ ]*`
        }
        if (p3) {
          return '[ ]+'
        }
        if (matchDiacritics) {
          return p4 || p5
        }

        if (p4) {
          return DIACRITICS_EXCEPTION.has(p4.charCodeAt(0)) ? p4 : ''
        }

        if (hasDiacritics) {
          isUnicode = true
          return `${p5}\\p{M}*`
        }
        return p5
      },
    )

    const trailingSpaces = '[ ]*'
    if (query.endsWith(trailingSpaces)) {
      // `[ ]*` 被添加是为了匹配诸如 "foo . bar" 的情况，
      // 但如果末尾是标点符号，不需要匹配它后面的空格。
      query = query.slice(0, query.length - trailingSpaces.length)
    }

    if (matchDiacritics) {
      if (hasDiacritics) {
        DIACRITICS_EXCEPTION_STR ||= String.fromCharCode(
          ...DIACRITICS_EXCEPTION,
        )

        isUnicode = true
        query = `${query}(?=[${DIACRITICS_EXCEPTION_STR}]|[^\\p{M}]|$)`
      }
    }

    return [isUnicode, query] as const
  }

  /**
   * 根据eolPositions分割字符串
   */
  private splitStringByEolPositions(
    pageContent: string,
    eolPositions: number[],
  ): { content: string; start: number }[] {
    if (!eolPositions.length) {
      return [{ content: pageContent, start: 0 }]
    }

    const parts: { content: string; start: number }[] = []
    let startPos = 0
    eolPositions.forEach((eolPos) => {
      parts.push({
        content: pageContent.slice(startPos, eolPos) || '',
        start: startPos,
      })
      startPos = eolPos
    })
    if (startPos < pageContent.length) {
      parts.push({
        content: pageContent.slice(startPos) || '',
        start: startPos,
      })
    }
    return parts
  }

  /**
   * 提取指定页数的文本
   */
  private async extractTextByPageNumber(pageNumber: number) {
    if (this.extractTextPromises.at(pageNumber - 1)) {
      return
    }
    const pageIndex = pageNumber - 1
    const textOptions = { disableNormalization: true }
    const { promise, resolve } = Promise.withResolvers<void>()
    this.extractTextPromises[pageIndex] = promise
    try {
      const pdfPage = await this.pdfDocument!.getPage(pageNumber)
      const textContent = await pdfPage.getTextContent(textOptions)
      const strBuf: string[] = []
      for (const textItem of textContent.items as TextItem[]) {
        strBuf.push(textItem.str)
        if (textItem.hasEOL) {
          strBuf.push('\n')
        }
      }
      // 将段落转换为字符串
      // const paragraphs = await extractParagraphs(pdfPage, textOptions, true)
      // const strBuf = paragraphs.map(p => p.sourceText).join('')
      ;[
        this.pageContents[pageIndex],
        this.pageDiffs[pageIndex],
        this.hasDiacritics[pageIndex],
        this.eolPositions[pageIndex],
      ] = normalize(strBuf.join(''))
      resolve()
    } catch (error) {
      console.error(`Unable to get text content for page ${pageNumber}`, error)
      this.pageContents[pageIndex] = ''
      this.pageDiffs[pageIndex] = null
      this.hasDiacritics[pageIndex] = false
      resolve()
    }
  }

  private requestMatchesCount() {
    const { pageIdx, matchIdx } = this._selected
    let current = 0,
      total = this.matchesCountTotal
    if (matchIdx !== -1) {
      for (let i = 0; i < pageIdx; i++) {
        current += this._pageMatches[i]?.length || 0
      }
      current += matchIdx + 1
    }
    // 当搜索开始时，此方法可能在 `pageMatches` 被计数（在 `#calculateMatch` 中）之前被调用。
    // 确保当活动的查找结果不合理时，UI 不会显示临时的错误状态。
    if (current < 1 || current > total) {
      current = total = 0
    }
    return { current, total }
  }

  private updateUIState(state: FindState, previous = false) {
    if (!this.updateMatchesCountOnProgress && state === FindState.PENDING) {
      return
    }
    this.eventBus.emit(FindEvent.UpdateFindControlState, {
      source: this,
      state,
      previous,
      entireWord: this.state?.entireWord ?? null,
      matchesCount: this.requestMatchesCount(),
      rawQuery: this.state?.query ?? null,
    })
  }

  private matchesReady(matches: number[]) {
    const numMatches = matches.length
    if (numMatches) {
      this.updateMatch(/* found = */ true)
      return true
    }
    return false
  }

  private shouldDirtyMatch(state: FindTextPayload) {
    if (!this._state) {
      return true
    }
    const { query: newQuery, pageNumber: newPageNumber } = state
    const { query: prevQuery, pageNumber: prevPageNumber } = this._state
    const currentPageNumber = this.linkService.page
    return (
      newQuery !== prevQuery ||
      newPageNumber !== prevPageNumber ||
      currentPageNumber !== prevPageNumber
    )
  }

  scrollMatchIntoView(options: {
    element?: HTMLElement
    pageIndex?: number
    matchIndex?: number
  }) {
    const { element = null, pageIndex = -1, matchIndex = -1 } = options
    const pageNumber = pageIndex + 1
    const pageView = this.linkService.getPageView(pageNumber)

    if (pageView && element) {
      const div = pageView.div
      scrollIntoView(this.container, div, {
        top: element.offsetTop / 2,
        isPageScroll: true,
      })
      return
    }
    this.linkService.goToPage(pageNumber)
  }

  private bindEvent() {
    this.eventBus.on(FindEvent.FindText, this.findText.bind(this), {
      signal: this.abortController?.signal,
    })
    this.eventBus.on(FindEvent.CloseFind, this.findClose.bind(this), {
      signal: this.abortController?.signal,
    })
  }

  reset() {
    this._state = null
    this._previousState = null
    this.rawQuery = null
    this._highlightMatches = false
    this.dirtyMatch = false
    this.extractTextPromises = []
    this.findTimeout = null
    this.firstPageCapability = Promise.withResolvers()
    this.pendingFindMatches = new Set()
    this._pageMatches = []
    this._pageMatchesLength = []
    this.matchesCountTotal = 0
    this._selected = {
      pageIdx: -1,
      matchIdx: -1,
    }
    this.abortController?.abort()
    this.abortController = new AbortController()
    this.bindEvent()
  }
}
