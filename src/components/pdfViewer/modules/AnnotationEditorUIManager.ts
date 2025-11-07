import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { HighlightItem } from '../components/HighlightList'
import { AnnotationEditorPrefix } from '../constants'
import {
  PDFPageEvent,
  PDFViewerEvent,
  UIEvents,
  type PDFEventBus,
} from '../events'
import { getRGB } from '../utils/display'
import type { AnnotationEditorLayer } from './AnnotationEditorLayer'
import type { LinkService } from './LinkService'
import type { PDFFindController } from './PDFFindController'
import type { PDFViewer } from './PDFViewer'
import type { Highlight, HighlightSerialized } from './highlight'

interface AnnotationEditorUIManagerOptions {
  container: HTMLElement
  viewer: HTMLElement
  eventBus: PDFEventBus
  linkService: LinkService
  pdfViewer: PDFViewer
  pdfDocument: PDFDocumentProxy
  findController: PDFFindController
}

interface HighlightSelectionOptions {
  selection?: Selection
  color?: string
  meta?: string
  hoverColor?: string
  clearSelection?: boolean
}

export interface TextToHighlight {
  text: string
  pageNumbers: number[]
  meta?: any
  color?: string
  hoverColor?: string
}

const SERIALIZED_HIGHLIGHT_PREFIX = 'serialized-highlight-'

export class AnnotationEditorUIManager {
  public container: HTMLElement
  public viewer: HTMLElement
  public eventBus: PDFEventBus
  public pdfDocument: PDFDocumentProxy
  public allEditors = new Map<string, Highlight>()

  private linkService: LinkService
  private findController: PDFFindController
  private pdfViewer: PDFViewer
  /**
   * HighlightIds 一对多
   * pageNumber -> serializedHighlightIds
   */
  private _highlightsMap = new Map<number, Set<string>>()
  /**
   * 一对一
   * serializedHighlightId -> highlight
   */
  private _serializedHighlightsMap = new Map<
    string,
    HighlightSerialized | TextToHighlight
  >()
  /**
   * 一对一
   * serializedHighlightId -> editorId
   */
  private _serializedHighlightToEditorIdMap = new Map<string, string>()
  /**
   * 一对一
   * 异步触发控制 TextToHighlight -> Promise<Highlight | null>
   */
  private _textToHighlightToEditorMap = new Map<
    string,
    Promise<Highlight | null>
  >()

  private id = 0
  private _serializedHighlightId = 0
  private allLayers = new Map<number, AnnotationEditorLayer>()
  // 取消事件订阅
  private eventAbortController: AbortController

  constructor(options: AnnotationEditorUIManagerOptions) {
    this.container = options.container
    this.viewer = options.viewer
    this.eventBus = options.eventBus
    this.pdfViewer = options.pdfViewer
    this.pdfDocument = options.pdfDocument
    this.findController = options.findController
    this.linkService = options.linkService
    this.eventAbortController = new AbortController()
    this.eventBus.on(
      PDFPageEvent.PageRendered,
      this.tryRenderHighlights.bind(this),
      { signal: this.eventAbortController.signal },
    )
  }

  getId() {
    return `${AnnotationEditorPrefix}${this.id++}`
  }

  getSerializedHighlightId() {
    return `${SERIALIZED_HIGHLIGHT_PREFIX}${this._serializedHighlightId++}`
  }

  /**
   * 获取选中的区域
   * @param textLayer - 文本层
   * @returns 选中的区域
   */
  getSelectionBoxes(textLayer?: HTMLElement) {
    if (!textLayer) {
      return null
    }
    const selection = document.getSelection()
    if (!selection) return
    for (let i = 0, ii = selection.rangeCount; i < ii; i++) {
      if (
        !textLayer.contains(selection.getRangeAt(i).commonAncestorContainer)
      ) {
        return null
      }
    }
    const {
      x: layerX,
      y: layerY,
      width: parentWidth,
      height: parentHeight,
    } = textLayer.getBoundingClientRect()

    const rotator = (x: number, y: number, w: number, h: number) => ({
      x: (x - layerX) / parentWidth,
      y: (y - layerY) / parentHeight,
      width: w / parentWidth,
      height: h / parentHeight,
    })

    const boxes = []
    for (let i = 0, ii = selection.rangeCount; i < ii; i++) {
      const range = selection.getRangeAt(i)
      if (range.collapsed) {
        continue
      }
      // @ts-ignore
      for (const { x, y, width, height } of range.getClientRects()) {
        if (width === 0 || height === 0) {
          continue
        }
        boxes.push(rotator(x, y, width, height))
      }
    }
    return boxes.length === 0 ? null : boxes
  }

  private getAnchorElementForSelection({ anchorNode }: Selection) {
    return anchorNode?.nodeType === Node.TEXT_NODE
      ? anchorNode.parentElement!
      : (anchorNode as HTMLElement)
  }

  private getLayerForTextLayer(textLayer: HTMLElement) {
    const layers = this.allLayers.values()
    // @ts-ignore
    for (const layer of layers) {
      if (layer.hasTextLayer(textLayer)) {
        return layer as AnnotationEditorLayer
      }
    }
    return null
  }

  /** 尝试渲染当前页面的高亮 */
  private tryRenderHighlights({ pageNumber }: { pageNumber: number }) {
    const layer = this.allLayers.get(pageNumber - 1)
    if (!layer) return
    const highlights = this._highlightsMap.get(pageNumber)
    if (!highlights?.size) return
    for (const id of highlights) {
      const highlight = this._serializedHighlightsMap.get(id)
      if (!highlight) continue
      if (this._serializedHighlightToEditorIdMap.has(id)) {
        continue
      }

      // 存在 highlight 且没有生成 editor
      if ('pageNumbers' in highlight) {
        this.textToHighlight(id, highlight)
      } else {
        this.highlightSerialized(id, highlight)
      }
    }
  }

  private addHighlight(highlight: HighlightSerialized | TextToHighlight) {
    const pageNumbers =
      'pageNumbers' in highlight
        ? highlight.pageNumbers
        : [highlight.pageIndex + 1]
    const boxes = 'pageNumbers' in highlight ? undefined : highlight.boxes
    const id = this.getSerializedHighlightId()
    // 多对一
    for (const pageNumber of pageNumbers) {
      const highlights = this._highlightsMap.get(pageNumber) || new Set()
      highlights.add(id)
      this._highlightsMap.set(pageNumber, highlights)
    }
    /// 一对一
    this._serializedHighlightsMap.set(id, highlight)
    const highlightItem: HighlightItem = {
      id,
      color: highlight.color,
      pageNumber: pageNumbers[0]!,
      matchPageNumbers: pageNumbers,
      boxes: boxes,
      text: highlight.text,
    }
    this.eventBus.emit(UIEvents.AddHighlight, {
      source: this,
      highlight: highlightItem,
    })
    return highlightItem
  }

  private addHighlightByEditor(editor: Highlight, highlightItemId?: string) {
    const serialized = editor.serialize()
    if (!serialized) return

    if (!highlightItemId) {
      const highlightItem = this.addHighlight(serialized)
      highlightItemId = highlightItem.id
    }
    // 关联editor
    this._serializedHighlightToEditorIdMap.set(highlightItemId, editor.id)
  }

  // 文本转高亮
  textToHighlights(highlightTexts: TextToHighlight[]) {
    const pageNumberSet = new Set<number>()
    for (const highlightText of highlightTexts) {
      this.addHighlight(highlightText)
      for (const pageNumber of highlightText.pageNumbers) {
        pageNumberSet.add(pageNumber)
      }
    }
    for (const pageNumber of pageNumberSet) {
      this.tryRenderHighlights({ pageNumber })
    }
  }

  // 高亮序列化转高亮数据
  highlightsSerialized(highlights: HighlightSerialized[]) {
    const pageNumberSet = new Set<number>()
    for (const highlight of highlights) {
      this.addHighlight(highlight)
      pageNumberSet.add(highlight.pageIndex + 1)
    }
    for (const pageNumber of pageNumberSet) {
      this.tryRenderHighlights({ pageNumber })
    }
  }

  highlightSelection(options?: HighlightSelectionOptions) {
    return this._highlightSelection(options)
  }

  updateHighlight(id: string, options: Highlight) {
    this.updateEditor(id, options)
  }

  private _highlightSelection(
    options?: HighlightSelectionOptions & {
      highlightItemId?: string
    },
  ) {
    const {
      color,
      hoverColor,
      clearSelection = true,
      meta,
      highlightItemId,
    } = options || {}
    const selection = options?.selection || window.getSelection()
    if (!selection || selection.isCollapsed) {
      return
    }
    const text = selection.toString()
    const anchorElement = this.getAnchorElementForSelection(selection)
    const textLayer = anchorElement.closest('.textLayer') as HTMLElement
    const boxes = this.getSelectionBoxes(textLayer)
    if (!boxes) return

    if (clearSelection) {
      selection.empty()
    }
    const layer = this.getLayerForTextLayer(textLayer)
    const editor = layer?.createAndAddNewEditor({
      text,
      boxes,
      meta,
      color,
      hoverColor,
    })
    if (!editor) return null
    this.addHighlightByEditor(editor, highlightItemId)
    return editor
  }

  private async textToHighlight(
    id: string,
    highlightText: TextToHighlight,
    autoScrollEditor = false,
  ) {
    // 异步
    if (this._textToHighlightToEditorMap.has(id)) {
      return this._textToHighlightToEditorMap.get(id)!
    }
    const { promise, resolve } = Promise.withResolvers<Highlight | null>()
    this._textToHighlightToEditorMap.set(id, promise)
    try {
      // 1. 匹配文本
      const { matches, matchesLength, pageNumber } =
        await this.findController.findTextPosition(
          highlightText.text,
          highlightText.pageNumbers,
        )
      if (autoScrollEditor) {
        // 2. 确保页面渲染完成
        this.linkService.page = pageNumber
      }
      const pdfPage = this.pdfViewer.getPageView(pageNumber)
      if (!pdfPage || !pdfPage.textLayer) return null
      // 3. 转为selection
      const selection = pdfPage.textLayer.convertMatchesToSelection(
        matches,
        matchesLength,
      )
      // 4. 高亮
      if (!selection) {
        return null
      }
      const editor = this._highlightSelection({
        selection,
        highlightItemId: id,
        meta: highlightText.meta,
        color: highlightText.color,
        hoverColor: highlightText.hoverColor,
      })
      if (!editor) return null
      this._serializedHighlightToEditorIdMap.set(id, editor.id)
      if (autoScrollEditor) {
        this.pdfViewer.scrollHighlightIntoView(editor)
      }
      // 派发事件，将text更新为highlight数据
      this.eventBus.emit(UIEvents.TextToHighlightSuccess, {
        source: highlightText,
        highlight: editor,
      })
      resolve(editor)
      return editor
    } catch (error) {
      resolve(null)
    } finally {
      this._textToHighlightToEditorMap.delete(id)
    }
  }

  highlightSerialized(
    id: string,
    highlight: HighlightSerialized,
    autoScrollEditor = false,
  ) {
    if (autoScrollEditor) {
      // 确保页面渲染
      this.linkService.page = highlight.pageIndex + 1
    }
    const pageIndex = highlight.pageIndex
    const layer = this.allLayers.get(pageIndex)
    if (!layer) return null
    const editor = layer.createAndAddNewEditor(highlight)
    this._serializedHighlightToEditorIdMap.set(id, editor.id)
    if (autoScrollEditor) {
      this.pdfViewer.scrollHighlightIntoView(editor)
    }
    return editor
  }

  async scrollHighlightIntoView(highlightItem: HighlightItem) {
    if (!this._serializedHighlightsMap.has(highlightItem.id)) {
      return null
    }
    // 如果已经存在editor, 则直接渲染
    if (this._serializedHighlightToEditorIdMap.has(highlightItem.id)) {
      // 确保页面渲染
      this.linkService.page = highlightItem.pageNumber
      const editorId = this._serializedHighlightToEditorIdMap.get(
        highlightItem.id,
      )!
      const editor = this.allEditors.get(editorId)
      if (editor) {
        this.pdfViewer.scrollHighlightIntoView(editor)
      }
      return editor
    }
    const highlight = this._serializedHighlightsMap.get(highlightItem.id)!
    if ('pageNumbers' in highlight) {
      return this.textToHighlight(highlightItem.id, highlight, true)
    }
    return this.highlightSerialized(highlightItem.id, highlight, true)
  }

  addLayer(layer: AnnotationEditorLayer) {
    this.allLayers.set(layer.pageIndex, layer)
  }

  convert(color: string) {
    const rgb = getRGB(color)
    return rgb
  }

  removeLayer(layer: AnnotationEditorLayer) {
    this.allLayers.delete(layer.pageIndex)
  }

  addEditor(editor: Highlight) {
    this.allEditors.set(editor.id, editor)
    this.eventBus.emit(PDFViewerEvent.EditorAdd, {
      source: this,
      editor,
    })
  }

  updateEditor(editorId: string, options: any) {
    const editor = this.allEditors.get(editorId)
    if (editor) {
      editor.meta = options
    }
    this.allEditors.set(editorId, editor as Highlight)
  }

  removeEditor(editor: Highlight) {
    this.allEditors.delete(editor.id)
    this.eventBus.emit(PDFViewerEvent.EditorRemove, {
      source: this,
      editor,
    })
  }

  getEditor(id: string) {
    return this.allEditors.get(id)
  }

  getEditors(pageIndex: number) {
    const editors = []
    for (const editor of this.allEditors.values()) {
      if (editor.pageIndex === pageIndex) {
        editors.push(editor)
      }
    }
    return editors
  }

  destroy() {
    for (const layer of this.allLayers.values()) {
      layer.destroy()
    }
    this.allLayers.clear()
    this.allEditors.clear()
    this._serializedHighlightsMap.clear()
    this._serializedHighlightToEditorIdMap.clear()
    this._textToHighlightToEditorMap.clear()
    this._highlightsMap.clear()
    this.eventAbortController.abort()
  }
}
