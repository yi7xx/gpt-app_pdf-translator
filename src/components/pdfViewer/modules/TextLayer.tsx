import { TextLayer, type PDFPageProxy, type PageViewport } from 'pdfjs-dist'
import { type getTextContentParameters } from 'pdfjs-dist/types/src/display/api'
import { bindEvents } from '../utils/ui'
import { TextHighlighter, convertMatches, type Match } from './TextHighlighter'

interface TextLayerOptions {
  pdfPage: PDFPageProxy
  highlighter: TextHighlighter
  onAppend: (textLayerDiv: HTMLDivElement) => void
}

export class TextLayerBuilder {
  public div: HTMLDivElement

  private pdfPage: PDFPageProxy
  private onAppend: (textLayerDiv: HTMLDivElement) => void | null
  private renderingDone = false
  private textLayer: TextLayer | null = null
  private highlighter: TextHighlighter
  private abortController: AbortController
  private static textLayers = new Map<HTMLDivElement, HTMLDivElement>()
  private static selectionChangeAbortController: AbortController | null = null

  constructor(options: TextLayerOptions) {
    this.pdfPage = options.pdfPage
    this.onAppend = options.onAppend || null
    this.highlighter = options.highlighter
    this.div = document.createElement('div')
    this.div.className = 'textLayer'
    this.abortController = new AbortController()
  }

  private bindMouse(end: HTMLDivElement) {
    bindEvents(this, this.div, ['mousedown', 'mouseup'], {
      signal: this.abortController.signal,
    })
    TextLayerBuilder.textLayers.set(this.div, end)
    TextLayerBuilder.enableGlobalSelectionListener()
  }

  private static enableGlobalSelectionListener() {
    if (this.selectionChangeAbortController) {
      return
    }
    this.selectionChangeAbortController = new AbortController()
    const { signal } = this.selectionChangeAbortController

    const reset = (end: HTMLDivElement, textLayer: HTMLElement) => {
      textLayer.append(end)
      end.style.width = ''
      end.style.height = ''
      textLayer.classList.remove('selecting')
    }

    let isPointerDown = false
    document.addEventListener(
      'pointerdown',
      () => {
        isPointerDown = true
      },
      { signal },
    )
    document.addEventListener(
      'pointerup',
      () => {
        isPointerDown = false
        this.textLayers.forEach(reset)
      },
      { signal },
    )

    window.addEventListener(
      'blur',
      () => {
        isPointerDown = false
        this.textLayers.forEach(reset)
      },
      { signal },
    )
    document.addEventListener(
      'keyup',
      () => {
        if (!isPointerDown) {
          this.textLayers.forEach(reset)
        }
      },
      { signal },
    )

    let isFirefox: boolean
    let prevRange: Range | null = null

    document.addEventListener(
      'selectionchange',
      () => {
        const selection = window.getSelection()
        if (selection == null || selection.rangeCount === 0) {
          this.textLayers.forEach(reset)
          return
        }

        const activeTextLayers = new Set<HTMLDivElement>()
        for (let i = 0; i < selection.rangeCount; i++) {
          const range = selection.getRangeAt(i)
          for (const textLayerDiv of this.textLayers.keys()) {
            if (
              !activeTextLayers.has(textLayerDiv) &&
              range.intersectsNode(textLayerDiv)
            ) {
              activeTextLayers.add(textLayerDiv)
            }
          }
        }

        for (const [textLayerDiv, end] of this.textLayers) {
          if (activeTextLayers.has(textLayerDiv)) {
            textLayerDiv.classList.add('selecting')
          } else {
            reset(end, textLayerDiv)
          }
        }

        // 处理 Firefox 的 selection 问题
        isFirefox ??=
          getComputedStyle(
            this.textLayers.keys().next().value!,
          ).getPropertyPriority('-moz-user-select') === 'none'

        if (isFirefox) {
          return
        }

        const range = selection.getRangeAt(0)
        const modifyStart =
          prevRange &&
          (range.compareBoundaryPoints(Range.END_TO_END, prevRange) === 0 ||
            range.compareBoundaryPoints(Range.START_TO_END, prevRange) === 0)
        let anchor = modifyStart ? range.startContainer : range.endContainer
        if (anchor.nodeType === Node.TEXT_NODE) {
          anchor = anchor.parentNode as Node
        }

        const parentTextLayer = anchor.parentElement?.closest(
          '.textLayer',
        ) as HTMLDivElement
        const endDiv = this.textLayers.get(parentTextLayer)
        if (endDiv) {
          endDiv.style.width = parentTextLayer.style.width
          endDiv.style.height = parentTextLayer.style.height
          anchor.parentElement?.insertBefore(
            endDiv,
            modifyStart ? anchor : anchor.nextSibling,
          )
        }
        prevRange = range.cloneRange()
      },
      { signal },
    )
  }

  private static removeGlobalSelectionListener(textLayerDiv: HTMLDivElement) {
    this.textLayers.delete(textLayerDiv)
    if (this.textLayers.size === 0) {
      this.selectionChangeAbortController?.abort()
      this.selectionChangeAbortController = null
    }
  }

  async render(
    viewport: PageViewport,
    textContentParams: getTextContentParameters | null = null,
  ) {
    if (this.renderingDone && this.textLayer) {
      this.textLayer.update({
        viewport,
        onBefore: this.hide.bind(this),
      })
      this.show()
      return
    }
    this.cancel()
    this.textLayer = new TextLayer({
      textContentSource: this.pdfPage.streamTextContent(
        textContentParams || {
          includeMarkedContent: true,
          disableNormalization: true,
        },
      ),
      container: this.div,
      viewport,
    })

    const { textDivs, textContentItemsStr } = this.textLayer

    this.highlighter.setTextMapping(textDivs, textContentItemsStr)

    await this.textLayer.render()
    const endOfContent = document.createElement('div')
    endOfContent.className = 'endOfContent'
    this.div.appendChild(endOfContent)
    this.bindMouse(endOfContent)

    this.renderingDone = true
    this.onAppend?.(this.div)
    this.highlighter.enable()
  }

  private normalizeMatches(matches: Match[], textDivs: HTMLElement[]) {
    const findTextNode = (node: HTMLElement): HTMLElement => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node
      }
      return findTextNode(node.childNodes[0] as HTMLElement)
    }
    const begin = matches[0]!.begin
    const end = matches[0]!.end
    if (!begin || !end) return []
    const beginDiv = findTextNode(textDivs[begin.divIdx]!)
    const endDiv = findTextNode(textDivs[end.divIdx]!)
    if (!beginDiv || !endDiv) return []
    return [
      { begin: beginDiv, offset: begin.offset },
      { end: endDiv, offset: end.offset },
    ] as const
  }

  /**
   * 文本高亮匹配，根据 matchs 和 matchesLength
   * */
  convertMatchesToSelection(
    textMatches: number[] | null,
    matchesLength: number[],
  ) {
    if (!this.textLayer) {
      return null
    }
    const { textDivs, textContentItemsStr } = this.textLayer
    if (!textContentItemsStr) {
      return null
    }
    const normalizedMatches = this.normalizeMatches(
      convertMatches(textMatches, matchesLength, textContentItemsStr),
      textDivs,
    )
    if (!normalizedMatches) {
      return null
    }
    try {
      const selection = window.getSelection()!
      selection.removeAllRanges()
      const range = document.createRange()
      const beginNode = normalizedMatches[0].begin
      const endNode = normalizedMatches[1].end
      range.setStart(beginNode, normalizedMatches[0].offset)
      range.setEnd(endNode, normalizedMatches[1].offset)
      selection.addRange(range)
      return selection
    } catch (error) {
      console.error(error)
      return null
    }
  }

  mousedown() {
    this.div.classList.add('selecting')
  }

  mouseup() {
    this.div.classList.remove('selecting')
  }

  hide() {
    if (!this.div.hidden && this.renderingDone) {
      this.highlighter.disable()
      this.div.hidden = true
    }
  }

  show() {
    if (this.div.hidden && this.renderingDone) {
      this.highlighter.enable()
      this.div.hidden = false
    }
  }

  cancel() {
    this.highlighter.disable()
    this.textLayer?.cancel()
    this.textLayer = null
    TextLayerBuilder.removeGlobalSelectionListener(this.div)
  }

  destroy() {
    this.abortController.abort()
  }
}
