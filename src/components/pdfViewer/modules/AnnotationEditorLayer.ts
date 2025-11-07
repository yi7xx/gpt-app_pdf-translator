import { setLayerDimensions, type PageViewport } from 'pdfjs-dist'
import { UIEvents, type PDFEventBus } from '../events'
import { DOMSVGFactoryInternal } from '../libs/pdfjs-internal'
import { bindEvents } from '../utils/ui'
import { AnnotationEditorLayerBuilder } from './AnnotationEditorLayerBuilder'
import { AnnotationEditorUIManager } from './AnnotationEditorUIManager'
import { TextLayerBuilder } from './TextLayer'
import { Highlight, type Boxes } from './highlight'

interface AnnotationEditorLayerOptions {
  div: HTMLDivElement
  pageIndex: number
  parent: AnnotationEditorLayerBuilder
  viewport: PageViewport
  textLayer: TextLayerBuilder
  eventBus: PDFEventBus
  annotationEditorUIManager: AnnotationEditorUIManager
  signal: AbortSignal | null
}

export class AnnotationEditorLayer {
  public div: HTMLDivElement | null
  public pageIndex: number
  public viewport: PageViewport
  public textLayer: TextLayerBuilder
  public _drawLayer: HTMLElement | null
  private uiManager: AnnotationEditorUIManager
  private eventBus: PDFEventBus
  private parent: AnnotationEditorLayerBuilder
  private id = 0
  private static domSvgFactory = new DOMSVGFactoryInternal()
  private mapping = new Map<number, SVGElement>()
  private editors = new Map<string, Highlight>()
  private signal: AbortSignal | null
  private hoveredId: number | null = null
  private selectedId: number | null = null

  constructor(options: AnnotationEditorLayerOptions) {
    this.div = options.div
    this.pageIndex = options.pageIndex
    this.viewport = options.viewport
    this.textLayer = options.textLayer
    this.uiManager = options.annotationEditorUIManager
    this.uiManager.addLayer(this)
    this.parent = options.parent
    this.signal = options.signal
    this.hoveredId = null
    this.selectedId = null
    this._drawLayer = null
    this.eventBus = options.eventBus
    this.bindMouseEvents()
  }

  static get _svgFactory() {
    return this.domSvgFactory
  }

  get drawLayer() {
    return this._drawLayer
  }

  get pageDimensions() {
    const { pageWidth, pageHeight } = this.viewport.rawDims as any
    return [pageWidth, pageHeight] as [number, number]
  }

  get pageTranslation() {
    const { pageX, pageY } = this.viewport.rawDims as any
    return [pageX, pageY] as [number, number]
  }

  setDrawLayer(wrapper?: HTMLElement) {
    if (!wrapper) {
      return
    }
    if (!this._drawLayer) {
      this._drawLayer = wrapper
      return
    }
    if (this._drawLayer !== wrapper) {
      if (this.mapping.size > 0) {
        for (const root of this.mapping.values()) {
          root.remove()
          wrapper.append(root)
        }
      }
      this._drawLayer = wrapper
    }
  }

  getNextId() {
    return this.uiManager.getId()
  }

  getSvgStyle(id: number) {
    if (this.mapping.has(id)) {
      return window.getComputedStyle(this.mapping.get(id)!)
    }
    return null
  }

  private bindMouseEvents() {
    const signal = this.signal || undefined
    bindEvents(
      this,
      this.div!,
      ['pointerover', 'pointerleave', 'pointerup', 'click'],
      { signal },
    )
    document.addEventListener(
      'click',
      () => {
        this.selectedId = null
        this.clearHoveredAndSelected()
      },
      { signal },
    )
  }

  private clearHoveredAndSelected() {
    for (const [id, element] of this.mapping) {
      this.updateProperties(element, {
        rootClass: {
          hovered: false,
          selected: id === this.selectedId,
        },
      })
    }
  }

  private handlePointerEvent(e: Event, className: string): HTMLElement | null {
    if (!this.div) {
      return null
    }
    const target = e.target as HTMLElement
    if (!this.div.contains(target) || !target.classList.contains(className)) {
      return null
    }
    return target
  }

  pointerover(e: PointerEvent) {
    const target = this.handlePointerEvent(e, 'internal')
    if (!target) {
      return
    }
    const id = +target.getAttribute('data-id')!
    if (this.hoveredId === id) {
      return
    }
    this.clearHoveredAndSelected()
    this.hoveredId = id
    this.updateProperties(id, {
      rootClass: {
        hovered: true,
      },
    })
  }

  pointerup(e: PointerEvent) {
    e.stopPropagation()
  }

  pointerleave() {
    this.hoveredId = null
    this.clearHoveredAndSelected()
  }

  click(e: MouseEvent) {
    const target = this.handlePointerEvent(e, 'internal')
    if (!target) {
      return
    }
    e.stopPropagation()
    const id = +target.getAttribute('data-id')!
    const currentSelectedId = this.selectedId
    this.selectedId = null

    const parentId = target.parentElement?.id

    const editor = this.editors.get(parentId!)

    this.clearHoveredAndSelected()
    if (currentSelectedId === id) {
      this.eventBus.emit(UIEvents.ToggleHighlight, {
        source: editor!,
        event: e,
        selected: false,
      })
      return
    }
    this.selectedId = id
    this.updateProperties(id, {
      rootClass: {
        selected: true,
      },
    })
    this.eventBus.emit(UIEvents.ToggleHighlight, {
      source: editor!,
      event: e,
      selected: true,
    })
  }

  private createNewEditor(options: {
    id: string
    boxes: Boxes
    text: string
    meta?: any
    color?: string
    opacity?: number
  }) {
    return new Highlight({
      ...options,
      uiManager: this.uiManager,
      parent: this,
    })
  }

  private createSVG() {
    const svg = AnnotationEditorLayer._svgFactory.create(
      1,
      1,
      /* skipDimensions = */ true,
    )
    this.drawLayer?.append(svg)
    svg.setAttribute('aria-hidden', true)
    return svg as SVGSVGElement
  }

  private createClipPath(defs: SVGDefsElement, pathId: string) {
    const clipPath = AnnotationEditorLayer._svgFactory.createElement('clipPath')
    defs.append(clipPath)
    const clipPathId = `clip_${pathId}`
    clipPath.setAttribute('id', clipPathId)
    clipPath.setAttribute('clipPathUnits', 'objectBoundingBox')
    const clipPathUse = AnnotationEditorLayer._svgFactory.createElement('use')
    clipPath.append(clipPathUse)
    clipPathUse.setAttribute('href', `#${pathId}`)
    clipPathUse.classList.add('clip')
    return clipPathId
  }

  private _updateProperties(element: SVGElement, properties: any) {
    for (const [key, value] of Object.entries<string>(properties)) {
      if (value === null) {
        element.removeAttribute(key)
      } else {
        element.setAttribute(key, value)
      }
    }
  }

  private setBox(
    element: SVGElement,
    [x, y, width, height]: [number, number, number, number],
  ) {
    const { style } = element
    style.top = `${100 * y}%`
    style.left = `${100 * x}%`
    style.width = `${100 * width}%`
    style.height = `${100 * height}%`
  }

  updateProperties(elementOrId: SVGElement | number, properties: any) {
    if (!properties) {
      return
    }
    const { root, bbox, rootClass, path, property } = properties
    const element =
      typeof elementOrId === 'number'
        ? this.mapping.get(elementOrId)!
        : elementOrId
    if (!element) {
      return
    }
    if (root) {
      this._updateProperties(element, root)
    }
    if (bbox) {
      this.setBox(element, bbox)
    }
    if (rootClass) {
      const { classList } = element
      for (const [className, value] of Object.entries<boolean>(rootClass)) {
        classList.toggle(className, value)
      }
    }
    if (property) {
      const { style } = element
      for (const [key, value] of Object.entries<string>(property)) {
        style.setProperty(key, value)
      }
    }
    if (path) {
      const defs = element.firstChild as SVGDefsElement
      const pathElement = defs.firstChild as SVGPathElement
      this._updateProperties(pathElement, path)
    }
  }

  draw(properties: any) {
    const id = this.id++
    const root = this.createSVG()
    const defs = AnnotationEditorLayer._svgFactory.createElement('defs')
    root.append(defs)
    const path = AnnotationEditorLayer._svgFactory.createElement('path')
    defs.append(path)
    const pathId = `path-p${this.pageIndex}-${id}`
    path.setAttribute('id', pathId)
    path.setAttribute('vector-effect', 'non-scaling-stroke')

    const clipPath = this.createClipPath(defs, pathId)
    const use = AnnotationEditorLayer._svgFactory.createElement('use')
    root.append(use)
    use.setAttribute('href', `#${pathId}`)
    this.updateProperties(root, properties)

    this.mapping.set(id, root)

    return { id, clipPath: `url(#${clipPath})` }
  }
  drawOutline(properties: any) {
    const id = this.id++
    const root = this.createSVG()
    const defs = AnnotationEditorLayer._svgFactory.createElement('defs')
    root.append(defs)
    const path = AnnotationEditorLayer._svgFactory.createElement('path')
    defs.append(path)
    const pathId = `path_p${this.pageIndex}_${id}`
    path.setAttribute('id', pathId)
    path.setAttribute('vector-effect', 'non-scaling-stroke')

    const use1 = AnnotationEditorLayer._svgFactory.createElement('use')
    root.append(use1)
    use1.setAttribute('href', `#${pathId}`)
    const use2 = use1.cloneNode()
    root.append(use2)
    use1.classList.add('mainOutline')
    use2.classList.add('secondaryOutline')

    this.updateProperties(root, properties)

    this.mapping.set(id, root)
    return id
  }

  createAndAddNewEditor(options: {
    boxes: Boxes
    text: string
    meta?: any
    color?: string
    hoverColor?: string
    opacity?: number
  }) {
    const id = this.getNextId()
    const editor = this.createNewEditor({
      id,
      ...options,
    })
    if (editor) {
      this.add(editor)
    }
    return editor
  }

  attach(editor: Highlight) {
    this.editors.set(editor.id, editor)
  }

  detach(editor: Highlight) {
    this.editors.delete(editor.id)
  }

  changeParent(editor: Highlight) {
    if (editor.parent === this) {
      return
    }
    this.attach(editor)
    editor.parent?.detach(editor)
    editor.setParent(this)
    if (editor.div && editor.isAttachedToDOM) {
      editor.div.remove()
      this.div!.append(editor.div)
    }
  }

  remove(editor: Highlight) {
    this.detach(editor)
    this.uiManager.removeEditor(editor)
    editor.div?.remove()
    editor.isAttachedToDOM = false
  }

  drawLayerRemove(id: number) {
    if (this.drawLayer === null) {
      return
    }
    this.mapping.get(id)?.remove()
    this.mapping.delete(id)
  }

  hasTextLayer(textLayer: HTMLElement) {
    return textLayer === this.textLayer?.div
  }

  add(editor: Highlight) {
    if (editor.parent === this && editor.isAttachedToDOM) {
      return
    }
    this.changeParent(editor)
    this.uiManager.addEditor(editor)
    this.attach(editor)

    if (!editor.isAttachedToDOM) {
      const div = editor.render()
      this.div!.append(div)
      editor.isAttachedToDOM = true
    }
  }

  render({ viewport }: { viewport: PageViewport }) {
    if (!this.div) {
      return
    }
    this.viewport = viewport
    setLayerDimensions(this.div, this.viewport)
    for (const editor of this.uiManager.getEditors(this.pageIndex)) {
      this.add(editor)
    }
  }

  update({ viewport }: { viewport: PageViewport }) {
    if (!this.div) {
      return
    }
    this.viewport = viewport
    setLayerDimensions(this.div, this.viewport)
  }

  destroy() {
    for (const editor of this.editors.values()) {
      editor.setParent(null)
      editor.isAttachedToDOM = false
      editor.div?.remove()
    }
    this.div = null
    this._drawLayer = null
    this.editors.clear()
    this.mapping.clear()
    this.uiManager.removeLayer(this)
  }

  cancelDrawLayer() {
    for (const editor of this.mapping.values()) {
      editor.remove()
    }
    this.mapping.clear()
  }
}
