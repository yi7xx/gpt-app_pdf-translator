import { PDFTranslationEditorLayer } from './PDFTransEditorLayer'
import { type Paragraph } from './PDFTransViewerUIManager'

interface PDFTransEditorItemProps {
  id: string
  paragraph: Paragraph
  parent: PDFTranslationEditorLayer
}

// 边界容差
const BOUNDARY_TOLERANCE = 20

export class PDFTransEditorItem {
  public id: string
  public parent: PDFTranslationEditorLayer
  public paragraph: Paragraph
  private div: HTMLDivElement | null
  private span: HTMLSpanElement | null
  private x: number
  private y: number
  private width: number
  private height: number
  private _fontSize: number
  private _mergeLine: number
  private backgroundColor: string
  // 真实dom的rect
  private _rectDiv: [number, number, number, number]
  private _rectSpan: [number, number, number, number]
  private _syncTimer: NodeJS.Timeout | null
  constructor(options: PDFTransEditorItemProps) {
    this.id = options.id
    this.paragraph = options.paragraph
    this.parent = options.parent
    this.x = this.y = 0
    this.width = this.height = 0
    this.div = null
    this.span = null
    this.backgroundColor = 'rgba(255, 255, 255, 1)'
    this._mergeLine = 0
    this._fontSize = 0
    this._syncTimer = null
    this._rectDiv = [0, 0, 0, 0]
    this._rectSpan = [0, 0, 0, 0]
  }

  get parentDimensions(): [number, number] {
    const {
      scale,
      pageDimensions: [pageWidth, pageHeight],
    } = this.parent
    return [pageWidth * scale, pageHeight * scale]
  }

  get dimensions(): [number, number] {
    const [parentWidth, parentHeight] = this.parentDimensions
    return [this.width * parentWidth, this.height * parentHeight]
  }

  // 获取矩形
  get rect() {
    const [parentWidth, parentHeight] = this.parentDimensions
    return [
      this.x * parentWidth,
      this.y * parentHeight,
      this.width * parentWidth,
      this.height * parentHeight,
    ] as const
  }

  get rectBox() {
    const isOverflow = this.div!.classList.contains('editorItemOverflow')
    const isActive = this.div!.classList.contains('active')
    if (this._syncTimer || isActive) {
      this.syncRect()
    }
    const [x, y, width, height] = this._rectDiv
    const [_1, _2, spanWidth, spanHeight] = this._rectSpan
    if (isOverflow || height > spanHeight) {
      return [
        x,
        y,
        Math.max(width, spanWidth),
        Math.max(height, spanHeight),
      ] as const
    }
    return [x, y, width, height] as const
  }

  get rawRect() {
    const [parentWidth, parentHeight] = this.parentDimensions
    const [x, y, width, height] = this.paragraph.box
    return [
      x * parentWidth,
      y * parentHeight,
      width * parentWidth,
      height * parentHeight,
    ] as const
  }

  get fontSize() {
    return this.paragraph.fontSize
  }

  // 获取旋转角度，0-360
  get rotate() {
    const rotate = this.paragraph.angle || 0
    return (rotate + 360) % 360
  }

  // 计算实际行高，并限制在最小值和最大值之间
  get lineHeight() {
    const { mergeLine, fontSize } = this
    const [_, pageHeight] = this.parent.pageDimensions
    const height = this.paragraph.box[3] * pageHeight
    if (mergeLine === -1) {
      return 1.2 * fontSize
    }
    // 设置最小值为 1.2，最大值为 1.8
    const minLineHeight = fontSize * 0.8
    const maxLineHeight = fontSize * 1.8
    const lineHeight = height / (mergeLine + 1)
    return Math.min(Math.max(lineHeight, minLineHeight), maxLineHeight)
  }

  get mergeLine() {
    return this._mergeLine
  }

  get text() {
    return this.paragraph.text || ''
  }

  get sourceText() {
    return this.paragraph.sourceText
  }

  get model() {
    return this.paragraph.model
  }

  get style() {
    const style = window.getComputedStyle(this.span!)
    return {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      fontWeight: style.fontWeight,
    }
  }

  private syncRect() {
    this.clearSyncTimer()
    if (!this.div || !this.span) {
      return
    }
    const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = this.div
    const { offsetWidth: spanWidth, offsetHeight: spanHeight } = this.span
    this._rectDiv = [offsetLeft, offsetTop, offsetWidth, offsetHeight]
    this._rectSpan = [0, 0, spanWidth, spanHeight]
  }

  private clearSyncTimer() {
    if (this._syncTimer) {
      clearTimeout(this._syncTimer)
      this._syncTimer = null
    }
  }

  private getBaseTranslation() {
    return [0, 0] as const
  }

  private translate([width, height]: [number, number], x = 0, y = 0) {
    this.x += x / width
    this.y += y / height
    this.fixAndSetPosition()
  }

  private syncLayoutBox() {
    const { x, y, width, height } = this
    this.paragraph.layoutBox = [x, y, width, height]
  }

  // 设置激活状态的样式
  setActive(active: boolean) {
    if (this.div) {
      this.div.classList.toggle('active', active)
    }
  }

  containsPoint(x: number, y: number) {
    let [x1, y1, w, h] = this.rawRect
    switch (this.rotate) {
      case 90:
        ;[x1, y1, w, h] = [x1, y1, h, w]
        break
      case 270:
        ;[x1, y1, w, h] = [x1, y1 - w + h, h, w]
        break
    }
    return x >= x1 && x <= x1 + w && y >= y1 && y <= y1 + h
  }

  resetParagraph() {
    this.paragraph.layoutBox = [...this.paragraph.box]
    this.paragraph.fontSize = this._fontSize
    ;[this.x, this.y, this.width, this.height] = this.paragraph.box
    this.removeOverflowStyle()
    this.translate(this.parentDimensions)
    const [width, height] = this.dimensions
    this.setDims(width, height)
  }

  setOverflowStyle() {
    if (!this.div) {
      return
    }
    this.div.classList.add('editorItemOverflow')
  }

  removeOverflowStyle() {
    if (!this.div) {
      return
    }
    this.div.classList.remove('editorItemOverflow')
  }

  fixAndSetPosition() {
    const {
      div,
      parentDimensions: [pageWidth, pageHeight],
    } = this
    let { x, y, width, height } = this

    width *= pageWidth
    height *= pageHeight
    x *= pageWidth
    y *= pageHeight

    x = Math.max(0, Math.min(pageWidth - width, x))
    y = Math.max(0, Math.min(pageHeight - height, y))

    this.x = x /= pageWidth
    this.y = y /= pageHeight

    const [bx, by] = this.getBaseTranslation()
    x += bx
    y += by

    div!.style.left = `${(100 * x).toFixed(2)}%`
    div!.style.top = `${(100 * y).toFixed(2)}%`
  }

  setDims(width: number, height: number) {
    const [parentWidth, parentHeight] = this.parentDimensions
    const { style } = this.div!
    style.width = `${((100 * width) / parentWidth).toFixed(2)}%`
    style.height = `${((100 * height) / parentHeight).toFixed(2)}%`
    this._syncTimer = setTimeout(this.syncRect.bind(this), 0)
  }

  updateText(text: string) {
    this.paragraph.text = text
    if (this.span) {
      this.span.textContent = text
    }
  }

  updateModel(model: string) {
    this.paragraph.model = model
  }

  // 设置行高
  setLineHeight(fontSize: number) {
    const { style } = this.div!
    style.setProperty('--line-height', `${this.lineHeight / fontSize}`)
  }

  // 设置字体
  setFontSize(fontSize: number) {
    const { style } = this.div!
    style.fontSize = `calc(var(--scale-factor) * ${fontSize}px)`
  }

  // 调整布局
  adjustLayout(options: {
    width?: number
    height?: number
    fontSize?: number
  }) {
    const [parentWidth, parentHeight] = this.parentDimensions
    const [originalWidth, originalHeight] = this.dimensions
    const {
      width = originalWidth,
      height = originalHeight,
      fontSize = this.paragraph.fontSize,
    } = options
    this.width = width / parentWidth
    this.height = height / parentHeight
    this.paragraph.fontSize = fontSize
    // 同步layoutBox
    this.setDims(width, height)
    this.setFontSize(fontSize)
    this.setLineHeight(fontSize)
    this.syncLayoutBox()
  }

  // 校验边界
  checkBoundary() {
    const [parentWidth, parentHeight] = this.parentDimensions
    const [x, y, width, height] = this.rect
    return (
      x + width > parentWidth - BOUNDARY_TOLERANCE ||
      y + height > parentHeight - BOUNDARY_TOLERANCE
    )
  }

  // 检查是否与其他editorItem重叠
  checkIsOverlap(editorItem: PDFTransEditorItem) {
    const [x1, y1, w1, h1] = this.rect
    const [x2, y2, w2, h2] = editorItem.rect
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2
  }

  // 检查是否超出容器
  checkIsOutOfContainer() {
    if (!this.span) {
      console.error('editor item is not created')
      return
    }
    const rects = this.span.getClientRects()
    // 是否超出行
    if (this.mergeLine === 0) {
      return rects.length > this.mergeLine + 1
    }
    // const isOutOfLine = rects.length > this.mergeLine + 1
    // if (isOutOfLine) {
    //   return true
    // }
    if (rects.length <= 1) {
      return false
    }
    const [_, parentHeight] = this.parentDimensions
    const rect = rects[0]!
    const lastRect = rects[rects.length - 1]!
    const diff = lastRect.bottom - rect.top
    const height = this.height * parentHeight

    if (diff - height > 0.1) {
      return true
    }
    return false
  }

  render() {
    const div = (this.div = document.createElement('div'))
    div.className = 'pdfTransEditorItem'
    div.setAttribute('data-id', this.id)
    const {
      layoutBox,
      fontSize,
      fontFamily,
      isBold,
      isItalic,
      isMarked,
      angle,
    } = this.paragraph
    this._mergeLine = this.paragraph.mergeLine || -1
    this._fontSize = fontSize
    ;[this.x, this.y, this.width, this.height] = layoutBox

    div.style.fontFamily = fontFamily || ''
    div.style.fontWeight = isBold ? 'bold' : 'normal'
    div.style.fontStyle = isItalic ? 'italic' : 'normal'
    // TODO: 翻译文本使用背景色，暂时不去判断 isMarked
    div.style.backgroundColor = this.backgroundColor
    // div.style.backgroundColor = isMarked ? this.backgroundColor : ''
    div.style.transform = angle ? `rotate(${angle}deg)` : ''
    this.setFontSize(fontSize)
    this.setLineHeight(fontSize)

    const span = (this.span = document.createElement('span'))
    span.className = 'pdfTransEditorItemText'
    span.textContent = this.text
    div.append(span)

    this.translate(this.parentDimensions)
    const [width, height] = this.dimensions
    this.setDims(width, height)
    return div
  }

  update() {
    this.syncRect()
  }

  remove() {
    this.div?.remove()
    this.clearSyncTimer()
    this.div = null
    this.span = null
  }

  serialize(): Paragraph {
    return {
      ...this.paragraph,
      layoutBox: [this.x, this.y, this.width, this.height],
    }
  }
}
