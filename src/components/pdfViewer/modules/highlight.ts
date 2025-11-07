import {
  HighlightOutlinerInternal,
  type HighlightOutline,
} from '../libs/pdfjs-internal'
import { AnnotationEditorLayer } from './AnnotationEditorLayer'
import { AnnotationEditorUIManager } from './AnnotationEditorUIManager'

export type Boxes = {
  x: number
  y: number
  width: number
  height: number
}[]

export type HighlightSerialized = {
  rect: number[]
  color: string
  hoverColor: string
  opacity: number
  boxes: Boxes
  text: string
  pageIndex: number
  /**
   * serialize时 不返回meta
   */
  meta?: any
}

interface HighlightOptions {
  id: string
  boxes: Boxes
  text: string
  uiManager: AnnotationEditorUIManager
  parent: AnnotationEditorLayer
  meta?: any
  opacity?: number
  color?: string
  hoverColor?: string
}

export const DEFAULT_HIGHLIGHT_COLOR = '#7a59ff52'
export const DEFAULT_HIGHLIGHT_HOVER_COLOR = '#7a59ff66'

export class Highlight {
  private name = 'highlightEditor'
  public x: number = 0
  public y: number = 0
  public width: number = 0
  public height: number = 0
  public id: string
  public parent: AnnotationEditorLayer | null = null
  public isAttachedToDOM: boolean = false
  public div: HTMLDivElement | null = null
  public pageIndex: number = 0
  public pageDimensions: [number, number] = [0, 0]
  public pageTranslation: [number, number] = [0, 0]
  public color: string
  public meta: any // 额外信息

  private _boxes: Boxes
  private _text: string
  private uiManager: AnnotationEditorUIManager
  private highlightOutlines: HighlightOutline | null = null
  private focusOutlines: HighlightOutline | null = null
  private lastPoint: [number, number] | null = null
  private clipPathId: string | null = null
  private opacity: number
  private hoverColor: string
  private _id: number | null = null
  private outlineId: number | null = null
  private thickness = 0
  private highlightDiv: HTMLDivElement | null = null

  constructor(options: HighlightOptions) {
    const parent = options.parent
    this.id = options.id
    this._boxes = options.boxes
    this._text = options.text
    this.meta = options.meta
    this.uiManager = options.uiManager
    this.opacity = options.opacity ?? 1
    this.color = options.color ?? '#7a59ff52'
    this.hoverColor = options.hoverColor ?? '#7a59ff66'
    this.isAttachedToDOM = false
    this.div = null
    this.parent = parent
    this.pageIndex = parent.pageIndex
    this.pageDimensions = [...parent.pageDimensions]
    this.pageTranslation = [...parent.pageTranslation]
    this.createOutLine()
    this.addToDrawLayer()
  }

  get boxes() {
    return this._boxes
  }

  private createOutLine() {
    const outliner = new HighlightOutlinerInternal(
      this.boxes,
      /* borderWidth = */ 0.001,
    )
    this.highlightOutlines = outliner.getOutlines() as any
    ;[this.x, this.y, this.width, this.height] = this.highlightOutlines!.box
    const outlinerForOutline = new HighlightOutlinerInternal(
      this.boxes,
      /* borderWidth = */ 0.0025,
      /* innerMargin = */ 0.001,
      /* isLTR = */ true,
    )
    this.focusOutlines = outlinerForOutline.getOutlines() as any

    const { lastPoint } = this.focusOutlines!
    this.lastPoint = [
      (lastPoint[0] - this.x) / this.width,
      (lastPoint[1] - this.y) / this.height,
    ]
  }

  get parentDimensions(): [number, number] {
    if (!this.parent?.div) {
      return [0, 0]
    }
    const { clientWidth, clientHeight } = this.parent!.div
    return [clientWidth, clientHeight]
  }

  get text() {
    return this._text
  }

  get rect() {
    if (!this.div) {
      return null
    }
    return this.div.getBoundingClientRect()
  }

  private addToDrawLayer(parent = this.parent) {
    if (this._id !== null) {
      return
    }

    const { id, clipPath } = parent!.draw({
      bbox: this.highlightOutlines!.box,
      root: {
        viewBox: '0 0 1 1',
        fill: this.color,
        'fill-opacity': this.opacity,
      },
      rootClass: {
        highlight: true,
        free: false,
      },
      path: {
        d: this.highlightOutlines!.toSVGPath(),
      },
      property: {
        '--hover-color': this.hoverColor,
      },
    })
    this._id = id
    this.clipPathId = clipPath

    this.outlineId = parent!.drawOutline({
      rootClass: {
        highlightOutline: true,
        free: false,
      },
      bbox: this.focusOutlines!.box,
      path: {
        d: this.focusOutlines!.toSVGPath(),
      },
    })

    if (this.highlightDiv) {
      this.highlightDiv.style.clipPath = this.clipPathId
    }
  }

  setParent(parent: AnnotationEditorLayer | null) {
    if (this.parent && !parent) {
      this.cleanDrawLayer()
    } else if (parent) {
      this.addToDrawLayer(parent)
    }
    if (parent !== null) {
      this.pageIndex = parent.pageIndex
      this.pageDimensions = [...parent.pageDimensions]
      this.pageTranslation = [...parent.pageTranslation]
    }
    this.parent = parent
  }

  getInitialTranslation() {
    return [0, 0] as const
  }

  getBaseTranslation() {
    return [0, 0] as const
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

  translate(x: number, y: number) {
    const [width, height] = this.parentDimensions
    this.x += x / width
    this.y += y / height

    this.fixAndSetPosition()
  }

  private createDiv() {
    this.div = document.createElement('div')
    this.div.className = this.name
    this.div.setAttribute('id', this.id)
    this.div.style.zIndex = '55'
    const [tx, ty] = this.getInitialTranslation()
    this.translate(tx, ty)
    return this.div
  }

  setDims(width: number, height: number) {
    const [parentWidth, parentHeight] = this.parentDimensions
    const { style } = this.div!
    style.width = `${((100 * width) / parentWidth).toFixed(2)}%`
    style.height = `${((100 * height) / parentHeight).toFixed(2)}%`
  }

  render() {
    if (this.div) {
      return this.div
    }
    const div = this.createDiv()
    if (this._text) {
      div.setAttribute('aria-label', this._text)
      div.setAttribute('role', 'mark')
    }
    const highlightDiv = (this.highlightDiv = document.createElement('div'))
    div.append(highlightDiv)
    highlightDiv.setAttribute('aria-hidden', 'true')
    highlightDiv.className = 'internal'
    highlightDiv.setAttribute('data-id', `${this._id}`)
    highlightDiv.setAttribute('data-outline-id', `${this.outlineId}`)
    highlightDiv.style.clipPath = this.clipPathId!

    const [parentWidth, parentHeight] = this.parentDimensions
    this.setDims(this.width * parentWidth, this.height * parentHeight)
    return div
  }

  private cleanDrawLayer() {
    if (this._id === null || !this.parent) {
      return
    }
    this.parent.drawLayerRemove(this._id)
    this._id = null
    this.parent.drawLayerRemove(this.outlineId!)
    this.outlineId = null
  }

  remove() {
    this.cleanDrawLayer()
    if (this.parent) {
      this.parent.remove(this)
    }
    this.parent = null
  }

  getRect() {
    if (!this.parent) {
      return null
    }
    const [pageWidth, pageHeight] = this.pageDimensions
    const [pageX, pageY] = this.pageTranslation
    const x = this.x * pageWidth
    const y = this.y * pageHeight
    const width = this.width * pageWidth
    const height = this.height * pageHeight
    return [
      x + pageX,
      pageHeight - y - height + pageY,
      x + width + pageX,
      pageHeight - y + pageY,
    ]
  }

  private serializeBoxes() {
    const [pageWidth, pageHeight] = this.pageDimensions
    const [pageX, pageY] = this.pageTranslation
    const boxes = this.boxes
    const quadPoints = new Float32Array(boxes.length * 8)
    let i = 0
    for (const { x, y, width, height } of boxes) {
      const sx = x * pageWidth + pageX
      const sy = (1 - y - height) * pageHeight + pageY
      // The specifications say that the rectangle should start from the bottom
      // left corner and go counter-clockwise.
      // But when opening the file in Adobe Acrobat it appears that this isn't
      // correct hence the 4th and 6th numbers are just swapped.
      quadPoints[i] = quadPoints[i + 4] = sx
      quadPoints[i + 1] = quadPoints[i + 3] = sy
      quadPoints[i + 2] = quadPoints[i + 6] = sx + width * pageWidth
      quadPoints[i + 5] = quadPoints[i + 7] = sy + height * pageHeight
      i += 8
    }
    return quadPoints
  }

  private serializeOutlines(rect: number[]) {
    return this.highlightOutlines?.serialize(rect, 0)
  }

  static getRectInCurrentCoords(rect: number[], pageHeight: number) {
    const [x1, y1, x2, y2] = rect as [number, number, number, number]
    const width = x2 - x1
    const height = y2 - y1
    return [x1, pageHeight - y2, width, height]
  }

  serialize(): HighlightSerialized | null {
    const rect = this.getRect()!
    if (typeof this._id === 'undefined' || !this.parent) {
      return null
    }
    const serialized = {
      rect,
      color: this.color,
      text: this.text,
      hoverColor: this.hoverColor,
      opacity: this.opacity,
      boxes: this.boxes,
      pageIndex: this.pageIndex,
    }
    return serialized
  }

  toJSON() {
    const rect = this.getRect()
    if (typeof this._id === 'undefined' || !this.parent) {
      return null
    }
    const serialized = {
      rect,
      color: this.color,
      hoverColor: this.hoverColor,
      opacity: this.opacity,
      boxes: this.boxes,
      pageIndex: this.parent.pageIndex,
    }
    return serialized
  }
}
