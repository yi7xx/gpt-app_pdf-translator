import { FindEvent, type PDFEventBus } from '../events'
import { PDFFindController } from './PDFFindController'

interface TextHighlighterOptions {
  eventBus: PDFEventBus
  findController: PDFFindController
  pageIndex: number
}

export interface Match {
  begin: { divIdx: number; offset: number }
  end: { divIdx: number; offset: number }
}

/**
 * 根据 matchs 和 matchesLength 匹配文本的位置
 */
export function convertMatches(
  matches: number[] | null,
  matchesLength: number[],
  textContentItemsStr: string[],
) {
  if (!matches) {
    return []
  }
  let i = 0,
    iIndex = 0
  const end = textContentItemsStr.length - 1
  const result = []

  for (let m = 0, mm = matches.length; m < mm; m++) {
    // 计算起始位置
    let matchIdx = matches[m]!

    while (i !== end && matchIdx >= iIndex + textContentItemsStr[i]!.length) {
      iIndex += textContentItemsStr[i]!.length
      i++
    }

    if (i === textContentItemsStr.length) {
      console.error('Could not find a matching mapping')
    }

    const match: any = {
      begin: {
        divIdx: i,
        offset: matchIdx - iIndex,
      },
    }

    // 计算结束位置
    matchIdx += matchesLength[m]!

    // 与上面的数组相同，但使用 > 而不是 >= 来获取结束位置
    while (i !== end && matchIdx > iIndex + textContentItemsStr[i]!.length) {
      iIndex += textContentItemsStr[i]!.length
      i++
    }

    match.end = {
      divIdx: i,
      offset: matchIdx - iIndex,
    }
    result.push(match as Match)
  }
  return result
}

export class TextHighlighter {
  private eventBus: PDFEventBus
  private findController: PDFFindController
  private pageIdx: number
  private textDivs: HTMLElement[] | null
  private textContentItemsStr: string[] | null
  private enabled = false
  private eventAbortController: AbortController | null
  private matches: Match[] = []

  constructor(options: TextHighlighterOptions) {
    this.eventBus = options.eventBus
    this.findController = options.findController
    this.pageIdx = options.pageIndex
    this.textDivs = null
    this.textContentItemsStr = null
    this.enabled = false
    this.eventAbortController = null
    this.matches = []
  }

  setTextMapping(textDivs: HTMLElement[], texts: string[]) {
    this.textDivs = textDivs
    this.textContentItemsStr = texts
  }

  disable() {
    if (!this.enabled) {
      return
    }
    this.enabled = false
    this.eventAbortController?.abort()
    this.eventAbortController = null
    this.updateMatches(/** reset */ true)
  }

  enable() {
    if (!this.textDivs || !this.textContentItemsStr) {
      throw new Error(
        'TextHighlighter: textDivs or textContentItemsStr is not set',
      )
    }
    if (this.enabled) {
      throw new Error('TextHighlighter: already enabled')
    }
    this.enabled = true
    if (!this.eventAbortController) {
      this.eventAbortController = new AbortController()
      this.eventBus.on(
        FindEvent.UpdateTextLayerMatches,
        ({ pageIndex, previousPageIndex }) => {
          if (pageIndex === this.pageIdx || pageIndex === -1) {
            const isSync = typeof previousPageIndex !== 'number'
            this.updateMatches(false, isSync)
          }
        },
        { signal: this.eventAbortController.signal },
      )
    }
    this.updateMatches()
  }

  private renderMatches(matches: Match[]) {
    if (matches.length === 0) {
      return
    }
    const { findController, pageIdx } = this
    const { textContentItemsStr, textDivs } = this

    if (!findController || !textDivs || !textContentItemsStr) {
      return
    }

    const isSelectedPage = pageIdx === findController.selected.pageIdx
    const selectedMatchIdx = findController.selected.matchIdx
    const highlightAll = findController.state!.highlightAll
    let prevEnd = null
    const infinity = {
      divIdx: -1,
      offset: undefined,
    }

    function beginText(begin: Match['begin'], className?: string) {
      const divIdx = begin.divIdx
      if (textDivs && textDivs[divIdx]?.textContent) {
        textDivs[divIdx]!.textContent = ''
      }
      return appendTextToDiv(divIdx, 0, begin.offset, className)
    }

    function appendTextToDiv(
      divIdx: number,
      fromOffset: number,
      toOffset?: number,
      className?: string,
    ) {
      let div = textDivs![divIdx]!
      if (div.nodeType === Node.TEXT_NODE) {
        const span = document.createElement('span')
        div.before(span)
        span.append(div)
        textDivs![divIdx] = span
        div = span
      }
      const content = textContentItemsStr![divIdx]!.substring(
        fromOffset,
        toOffset,
      )
      const node = document.createTextNode(content)
      if (className) {
        const span = document.createElement('span')
        span.className = `${className} appended`
        span.append(node)
        div.append(span)
        return className.includes('selected') ? span.offsetLeft : 0
      }
      div.append(node)
      return 0
    }

    let i0 = selectedMatchIdx,
      i1 = i0 + 1
    if (highlightAll) {
      i0 = 0
      i1 = matches.length
    } else if (!isSelectedPage) {
      return
    }

    let lastDivIdx = -1
    let lastOffset = -1
    for (let i = i0; i < i1; i++) {
      const match = matches[i]!
      const begin = match.begin
      if (begin.divIdx === lastDivIdx && begin.offset === lastOffset) {
        continue
      }
      lastDivIdx = begin.divIdx
      lastOffset = begin.offset

      const end = match.end
      const isSelected = isSelectedPage && i === selectedMatchIdx
      const highlightSuffix = highlightAll || isSelected ? ' selected' : ''
      let selectedLeft = 0

      if (!prevEnd || begin.divIdx !== prevEnd.divIdx) {
        if (prevEnd !== null) {
          appendTextToDiv(prevEnd.divIdx, prevEnd.offset, infinity.offset)
        }
        beginText(begin)
      } else {
        appendTextToDiv(prevEnd.divIdx, prevEnd.offset, begin.offset)
      }

      if (begin.divIdx === end.divIdx) {
        selectedLeft = appendTextToDiv(
          begin.divIdx,
          begin.offset,
          end.offset,
          'highlight' + highlightSuffix,
        )
      } else {
        selectedLeft = appendTextToDiv(
          begin.divIdx,
          begin.offset,
          infinity.offset,
          'highlight begin' + highlightSuffix,
        )
        for (let n0 = begin.divIdx + 1, n1 = end.divIdx; n0 < n1; n0++) {
          textDivs[n0]!.className = 'highlight middle' + highlightSuffix
        }
        beginText(end, 'highlight end' + highlightSuffix)
      }
      prevEnd = end

      if (isSelected) {
        findController.scrollMatchIntoView({
          element: textDivs[begin.divIdx],
          pageIndex: pageIdx,
          matchIndex: selectedMatchIdx,
        })
      }
    }

    if (prevEnd) {
      appendTextToDiv(prevEnd.divIdx, prevEnd.offset, infinity.offset)
    }
  }

  // 清空所有匹配
  private async clearMatches(async = true) {
    const { matches, textContentItemsStr, textDivs } = this
    if (!textDivs || !textContentItemsStr) {
      return
    }

    const tasks: Promise<void>[] = []

    let clearedUntilDivIdx = -1
    for (const match of matches) {
      const begin = Math.max(clearedUntilDivIdx, match.begin.divIdx)
      for (let n = begin, end = match.end.divIdx; n <= end; n++) {
        const div = textDivs[n]!
        if (div.classList.contains('highlight')) {
          // 退出动画的className
          div.classList.add('highlight-exit')
        } else {
          const highlights = div.querySelectorAll('.highlight')
          for (const highlight of highlights) {
            highlight.classList.add('highlight-exit')
          }
        }
        if (async) {
          const task = new Promise<void>((resolve) =>
            setTimeout(() => {
              div.className = ''
              div.textContent = textContentItemsStr[n]!
              resolve()
            }, 300),
          )
          tasks.push(task)
        } else {
          div.className = ''
          div.textContent = textContentItemsStr[n]!
        }
      }
      clearedUntilDivIdx = match.end.divIdx + 1
    }
    this.matches = []
    if (tasks.length > 0) {
      return await Promise.all(tasks)
    }
  }

  private async updateMatches(reset = false, async = true) {
    if (!this.enabled && !reset) {
      return
    }
    const { findController, pageIdx, textContentItemsStr, textDivs } = this

    if (!textDivs || !textContentItemsStr) {
      return
    }

    // 清空所有匹配
    await this.clearMatches(async)

    if (!findController?.highlightMatches || reset) {
      return
    }
    // 将 `findController` 上的匹配项转换为
    // textLayer 使用的匹配格式
    const pageMatches = findController.pageMatches[pageIdx] || null
    const pageMatchesLength = findController.pageMatchesLength[pageIdx] || []

    this.matches = convertMatches(
      pageMatches,
      pageMatchesLength,
      textContentItemsStr,
    )
    this.renderMatches(this.matches)
  }
}
