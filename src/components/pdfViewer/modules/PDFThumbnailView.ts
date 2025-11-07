import {
  OutputScale,
  RenderingCancelledException,
  type PDFPageProxy,
  type PageViewport,
  type RenderTask,
} from 'pdfjs-dist'
import { type PDFEventBus } from '../events'
import { PDFThumbnailEvent } from '../events/pdfThumbnail'
import { RenderingStates } from '../utils/ui'
import { LinkService } from './LinkService'
import { PDFPageView } from './PDFPageView'
import { PDFRenderingQueue } from './PDFRenderingQueue'

interface PDFThumbnailViewOptions {
  id: number
  eventBus: PDFEventBus
  defaultViewport: PageViewport
  linkService: LinkService
  renderingQueue: PDFRenderingQueue
}

const DRAW_UPSCALE_FACTOR = 2
const MAX_NUM_SCALING_STEPS = 3
const THUMBNAIL_WIDTH = 100

class TempImageFactory {
  static tempCanvas: HTMLCanvasElement | null = null

  static getCanvas(width: number, height: number) {
    const tempCanvas = (this.tempCanvas ||= document.createElement('canvas'))
    tempCanvas.width = width
    tempCanvas.height = height

    const ctx = tempCanvas.getContext('2d', { alpha: false })!
    ctx.save()
    ctx.fillStyle = 'rgb(255, 255, 255)'
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
    return [tempCanvas, tempCanvas.getContext('2d')] as [
      HTMLCanvasElement,
      CanvasRenderingContext2D,
    ]
  }

  static destroyCanvas() {
    const tempCanvas = this.tempCanvas
    if (tempCanvas) {
      tempCanvas.width = 0
      tempCanvas.height = 0
    }
    this.tempCanvas = null
  }
}

export class PDFThumbnailView {
  public id: number
  public div: HTMLElement
  public renderingState: RenderingStates
  public pdfPage: PDFPageProxy | null
  public image: string | null
  public renderingId: string
  public resume: (() => void) | null

  private eventBus: PDFEventBus
  private viewport: PageViewport
  private linkService: LinkService
  private renderingQueue: PDFRenderingQueue
  private renderTask: RenderTask | null
  public scale: number | null
  public canvasWidth: number | null
  public canvasHeight: number | null

  constructor(props: PDFThumbnailViewOptions) {
    this.id = props.id
    this.renderingId = `thumbnail-${this.id}`
    this.eventBus = props.eventBus
    this.viewport = props.defaultViewport
    this.linkService = props.linkService
    this.renderingQueue = props.renderingQueue
    this.pdfPage = null
    // 会通过组件初始化
    this.div = null as any
    this.image = null
    this.renderingState = RenderingStates.INITIAL
    this.renderTask = null
    this.resume = null
    this.scale = null
    this.canvasWidth = null
    this.canvasHeight = null
  }

  setDiv(div: HTMLElement) {
    if (this.div === div) {
      return
    }
    this.div = div
    this.updateDims()
  }

  goToPage() {
    this.linkService.goToPage(this.id)
  }

  setPdfPage(pdfPage: PDFPageProxy) {
    this.pdfPage = pdfPage
    this.viewport = pdfPage.getViewport({ scale: 1 })
    this.reset()
  }

  reset() {
    this.cancelRendering()
    this.renderingState = RenderingStates.INITIAL
    this.renderTask = null
    this.updateDims()
    TempImageFactory.destroyCanvas()
  }

  cancelRendering() {
    if (this.renderTask) {
      this.renderTask.cancel()
      this.renderTask = null
    }
    this.resume = null
  }

  setImage(pageView: PDFPageView) {
    if (this.renderingState !== RenderingStates.INITIAL) {
      return
    }
    const { scale, canvas, pdfPage } = pageView
    if (!canvas) {
      return
    }
    if (!this.pdfPage) {
      this.setPdfPage(pdfPage!)
    }
    if (scale < this.scale!) {
      // 避免放大图像， 生成的图片会造成预览图模糊。
      return
    }
    this.renderingState = RenderingStates.FINISHED
    this.convertCanvasToImage(canvas)
  }

  private getPageDrawContext(upscaleFactor = 1, willReadFrequently = true) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', {
      alpha: false,
      willReadFrequently,
    })!
    const outputScale = new OutputScale()
    canvas.width = (upscaleFactor * this.canvasWidth! * outputScale.sx) | 0
    canvas.height = (upscaleFactor * this.canvasHeight! * outputScale.sy) | 0
    const transform = outputScale.scaled
      ? [outputScale.sx, 0, 0, outputScale.sy, 0, 0]
      : undefined
    return { canvas, ctx, transform }
  }

  private updateDims() {
    if (!this.div) return
    const { width, height } = this.viewport
    const ratio = width / height

    this.canvasWidth = THUMBNAIL_WIDTH
    this.canvasHeight = (THUMBNAIL_WIDTH / ratio) | 0

    this.scale = this.canvasWidth / width
    const { style } = this.div
    style.setProperty('--thumbnail-width', `${this.canvasWidth}px`)
    style.setProperty('--thumbnail-height', `${this.canvasHeight}px`)
  }

  private finishRenderTask(
    renderTask: RenderTask,
    canvas: HTMLCanvasElement,
    error: Error | null = null,
  ) {
    if (this.renderTask !== renderTask) {
      return
    }
    this.div.removeAttribute('data-thumbnail-rendered')
    if (error instanceof RenderingCancelledException) {
      return
    }
    this.renderingState = RenderingStates.FINISHED
    this.convertCanvasToImage(canvas)

    if (error) {
      throw error
    }
  }

  private reduceImage(img: HTMLCanvasElement) {
    const { ctx, canvas } = this.getPageDrawContext(1, false)

    if (img.width <= 2 * canvas.width) {
      ctx.drawImage(
        img,
        0,
        0,
        img.width,
        img.height,
        0,
        0,
        canvas.width,
        canvas.height,
      )
      return canvas
    }
    let reducedWidth = canvas.width << MAX_NUM_SCALING_STEPS
    let reducedHeight = canvas.height << MAX_NUM_SCALING_STEPS
    const [reducedImage, reducedImageCtx] = TempImageFactory.getCanvas(
      reducedWidth,
      reducedHeight,
    )

    while (reducedWidth > img.width || reducedHeight > img.height) {
      reducedWidth >>= 1
      reducedHeight >>= 1
    }
    reducedImageCtx.drawImage(
      img,
      0,
      0,
      img.width,
      img.height,
      0,
      0,
      reducedWidth,
      reducedHeight,
    )
    while (reducedWidth > 2 * canvas.width) {
      reducedImageCtx.drawImage(
        reducedImage,
        0,
        0,
        reducedWidth,
        reducedHeight,
        0,
        0,
        reducedWidth >> 1,
        reducedHeight >> 1,
      )
      reducedWidth >>= 1
      reducedHeight >>= 1
    }
    ctx.drawImage(
      reducedImage,
      0,
      0,
      reducedWidth,
      reducedHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    )
    return canvas
  }

  private convertCanvasToImage(image: HTMLCanvasElement) {
    if (this.renderingState !== RenderingStates.FINISHED) {
      throw new Error('convertCanvasToImage: must be in finished state')
    }
    const reducedCanvas = this.reduceImage(image)
    this.image = reducedCanvas.toDataURL()
    reducedCanvas.width = 0
    reducedCanvas.height = 0
    this.eventBus.emit(PDFThumbnailEvent.ThumbnailUpdate, {
      source: this,
      pageNumber: this.id,
      src: this.image,
      pdfPage: this.pdfPage!,
    })
  }

  async draw() {
    if (this.renderingState !== RenderingStates.INITIAL) {
      console.error('Must be in initial state to drawing')
      return undefined
    }

    const { pdfPage } = this

    if (!pdfPage) {
      this.renderingState = RenderingStates.FINISHED
      throw new Error('pdfPage is not loaded')
    }

    this.renderingState = RenderingStates.RUNNING
    this.div.setAttribute('data-thumbnail-rendered', 'false')

    const { canvas, ctx, transform } =
      this.getPageDrawContext(DRAW_UPSCALE_FACTOR)

    const drawViewport = this.viewport.clone({
      scale: DRAW_UPSCALE_FACTOR * this.scale!,
    })

    const renderContinueCallback = (cont: () => void) => {
      if (!this.renderingQueue.isHighestPriority(this)) {
        this.renderingState = RenderingStates.PAUSED
        this.resume = () => {
          this.renderingState = RenderingStates.RUNNING
          cont()
        }
        return
      }
      cont()
    }

    const renderTask = (this.renderTask = pdfPage!.render({
      canvasContext: ctx,
      transform: transform,
      viewport: drawViewport,
    }))

    renderTask.onContinue = renderContinueCallback

    const resultPromise = renderTask.promise
      .then(
        () => this.finishRenderTask(renderTask, canvas),
        (error) => this.finishRenderTask(renderTask, canvas, error),
      )
      .finally(() => {
        canvas.width = 0
        canvas.height = 0
        this.eventBus.emit(PDFThumbnailEvent.ThumbnailRendered, {
          source: this,
          pageNumber: this.id,
          pdfPage: pdfPage!,
          timestamp: performance.now(),
        })
      })
    return resultPromise
  }
}
