import { setLayerDimensions, type PageViewport } from 'pdfjs-dist'
import { type PDFEventBus } from '../events'
import { PDFTransEditorItem } from './PDFTransEditorItem'
import {
  PDFTransViewerUIManager,
  type Paragraph,
} from './PDFTransViewerUIManager'

interface PDFTransEditorLayerProps {
  id: number
  div: HTMLDivElement
  viewport: PageViewport
  eventBus: PDFEventBus
  transUIManager: PDFTransViewerUIManager
}

// 宽度策略步长
const WIDTH_STEP = 2
// 高度策略步长
const HEIGHT_STEP = 2
// 字体策略步长
const FONT_STEP = 1.1
// 合并行数阈值
const MERGE_LINE_THRESHOLD = 4
// 最小字体的大小
const MIN_FONT_SIZE = 7

export abstract class PDFTranslationEditorLayer {
  public id: number
  public div: HTMLDivElement
  public viewport: PageViewport
  public itemId = 0
  public editorMap: Map<string, PDFTransEditorItem> = new Map()
  constructor(
    props: Pick<PDFTransEditorLayerProps, 'id' | 'div' | 'viewport'>,
  ) {
    this.id = props.id
    this.div = props.div
    this.viewport = props.viewport
  }

  get pageDimensions() {
    const { pageWidth, pageHeight } = this.viewport.rawDims as {
      pageWidth: number
      pageHeight: number
    }
    return [pageWidth, pageHeight] as const
  }

  abstract get scale(): number

  get nextId() {
    return `pdf-trans-editor_${this.id}_${this.itemId++}`
  }

  get paragraphs() {
    return Array.from(this.editorMap.values()).map((item) => item.serialize())
  }

  // 是否已存在编辑器
  get hasEditorItem() {
    return this.editorMap.size > 0
  }

  findEditorItemIndex(editorItem: PDFTransEditorItem) {
    const paragraphs = Array.from(this.editorMap.values()).map((item, idx) => ({
      paragraph: item.serialize(),
      id: item.id,
      index: idx,
    }))
    return paragraphs.findIndex((p) => p.id === editorItem.id)
  }

  resetParagraphs() {
    this.editorMap.forEach((item) => {
      item.resetParagraph()
    })
  }

  setDimensions(viewport: PageViewport) {
    this.viewport = viewport
    setLayerDimensions(this.div, viewport)
  }

  update(viewport: PageViewport) {
    this.setDimensions(viewport)
    for (const [_, editor] of this.editorMap) {
      editor.update()
    }
    this.autoLayout()
  }

  createTransEditorItem(paragraph: Paragraph) {
    const id = this.nextId
    return new PDFTransEditorItem({
      id,
      paragraph,
      parent: this,
    })
  }

  abstract render(viewport: PageViewport): Promise<void>

  private isOverlap(editorItem: PDFTransEditorItem) {
    if (editorItem.checkBoundary()) {
      return true
    }
    for (const [id, item] of this.editorMap) {
      if (id === editorItem.id) {
        continue
      }
      // 判断两个矩形是否重叠
      if (editorItem.checkIsOverlap(item)) {
        return true
      }
    }
    return false
  }

  private sizeStrategy(editorItem: PDFTransEditorItem) {
    const {
      dimensions: [originWidth, originHeight],
      lineHeight,
    } = editorItem
    let width = originWidth
    let height = originHeight

    while (true) {
      const currentWidth = width + WIDTH_STEP
      editorItem.adjustLayout({ width: currentWidth })
      if (this.isOverlap(editorItem)) {
        editorItem.adjustLayout({ width })
        break
      }
      if (!editorItem.checkIsOutOfContainer()) {
        return true
      }

      width = currentWidth
    }
    while (true) {
      const currentHeight = height + HEIGHT_STEP
      const diff = currentHeight - originHeight
      editorItem.adjustLayout({ height: currentHeight })
      if (this.isOverlap(editorItem)) {
        editorItem.adjustLayout({ height })
        break
      }
      if (!editorItem.checkIsOutOfContainer()) {
        return true
      }
      if (diff >= lineHeight) {
        editorItem.adjustLayout({ height })
        break
      }
      height = currentHeight
    }
    return false
  }

  private fontStrategy(editorItem: PDFTransEditorItem) {
    let { fontSize } = editorItem
    while (true) {
      const currentFontSize = fontSize / FONT_STEP
      if (currentFontSize < MIN_FONT_SIZE) {
        break
      }
      editorItem.adjustLayout({ fontSize: currentFontSize })
      if (!editorItem.checkIsOutOfContainer()) {
        return true
      }
      fontSize = currentFontSize
    }
    return false
  }

  // 自动布局调整策略
  private autoLayoutStrategy(editorItem: PDFTransEditorItem) {
    // 1. 宽度， 高度
    if (this.sizeStrategy(editorItem)) {
      editorItem.removeOverflowStyle()
      return
    }
    // 2. 字体
    if (this.fontStrategy(editorItem)) {
      editorItem.removeOverflowStyle()
      return
    }
    // 设置超出样式
    editorItem.setOverflowStyle()
  }

  // 自动调整布局
  autoLayout() {
    const editorItems = Array.from(this.editorMap.values())
    const overflowItems = editorItems
      .filter((item) => item.checkIsOutOfContainer())
      .filter((item) => {
        if (item.mergeLine < MERGE_LINE_THRESHOLD) {
          return true
        }
        return item.checkIsOutOfContainer()
      })
    // 对所有的超出内容进行自动调整布局
    for (const item of overflowItems) {
      this.autoLayoutStrategy(item)
    }
  }

  removeAllEditorItems() {
    this.editorMap.forEach((item) => {
      item.remove()
    })
    this.editorMap.clear()
  }

  destroy() {
    this.editorMap.clear()
  }
}

export class PDFTransEditorLayer extends PDFTranslationEditorLayer {
  private eventBus: PDFEventBus
  private transUIManager: PDFTransViewerUIManager
  // 上一次找到的编辑器
  private lastFindEditorItem: PDFTransEditorItem | null
  constructor(props: PDFTransEditorLayerProps) {
    super(props)
    this.eventBus = props.eventBus
    this.transUIManager = props.transUIManager
    this.transUIManager.addLayer(this)
    this.lastFindEditorItem = null
  }

  get scale() {
    return this.transUIManager.realScale
  }

  private getEditors() {
    return Array.from(this.editorMap.values())
  }

  update(viewport: PageViewport) {
    super.update(viewport)
    this.transUIManager.updateTransStatus(this.id)
  }

  findEditorItem(x: number, y: number) {
    if (
      this.lastFindEditorItem &&
      this.lastFindEditorItem.containsPoint(x, y)
    ) {
      return this.lastFindEditorItem
    }
    const editors = this.getEditors()
    if (!editors?.length) {
      return null
    }
    const editor = editors.find((e) => e.containsPoint(x, y)) || null
    this.lastFindEditorItem = editor
    return editor
  }

  private add(editorItem: PDFTransEditorItem) {
    const div = editorItem.render()
    this.editorMap.set(editorItem.id, editorItem)
    this.div.append(div)
    this.transUIManager.addPDFTransEditor(editorItem)
  }

  createAndAddNewEditor(paragraph: Paragraph) {
    const editor = this.createTransEditorItem(paragraph)
    this.add(editor)
    return editor
  }

  async render(viewport: PageViewport) {
    this.viewport = viewport
    this.setDimensions(viewport)
    this.transUIManager.renderParagraph(this.id)
  }

  destroy() {
    super.destroy()
    this.transUIManager.removeLayer(this.id)
  }
}

export class PDFTransEditorLayerPrint extends PDFTranslationEditorLayer {
  private _paragraphs: Paragraph[]
  constructor(
    props: Pick<PDFTransEditorLayerProps, 'id' | 'div' | 'viewport'> & {
      paragraph: Paragraph[]
    },
  ) {
    const { paragraph, ...rest } = props
    super(rest)
    this._paragraphs = paragraph
  }

  get scale() {
    return this.viewport.scale
  }

  async add(editor: PDFTransEditorItem) {
    const div = editor.render()
    this.editorMap.set(editor.id, editor)
    this.div.append(div)
  }

  async render(viewport: PageViewport) {
    this.viewport = viewport
    this.setDimensions(viewport)
    for (const paragraph of this._paragraphs) {
      const editor = this.createTransEditorItem(paragraph)
      if (editor) {
        this.add(editor)
      }
    }
    this.autoLayout()
  }
}
