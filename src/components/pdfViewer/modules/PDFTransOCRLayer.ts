// import { PixelsPerInch, type PDFPageProxy } from 'pdfjs-dist'
// import tippy, { type Instance } from 'tippy.js'
// import Loading1Icon from '../assets/loading1.svg?raw'
// import OCRIcon from '../assets/ocr.svg?raw'
// import { type PDFEventBus } from '../events'
// import { PDFTransPageView } from './PDFTransPageView'
// import { PDFTransViewerUIManager } from './PDFTransViewerUIManager'
// import { PDFViewer } from './PDFViewer'

export enum OCRStatus {
  NONE = 'none',
  OCRING = 'ocring',
  OCR_SUCCESS = 'ocr_success',
  OCR_FAILED = 'ocr_failed',
}

// interface PDFTransOCRLayerOptions {
//   id: number
//   pdfViewer: PDFViewer
//   pdfTransPage: PDFTransPageView
//   eventBus: PDFEventBus
//   pdfPage: PDFPageProxy
//   transUIManager: PDFTransViewerUIManager
//   onAppend?: (layer: HTMLElement) => void
// }

// export class PDFTransOCRLayer {
//   public id: number
//   public div: HTMLButtonElement | null
//   private eventBus: PDFEventBus
//   private pdfViewer: PDFViewer
//   private _status: OCRStatus
//   private pdfTransPage: PDFTransPageView
//   private abortController: AbortController | null
//   private transUIManager: PDFTransViewerUIManager
//   private tippyInstance: Instance | null
//   private cancelled: boolean
//   private pdfPage: PDFPageProxy
//   private onAppend: ((layer: HTMLElement) => void) | null
//   constructor(options: PDFTransOCRLayerOptions) {
//     this.id = options.id
//     this.eventBus = options.eventBus
//     this.pdfViewer = options.pdfViewer
//     this.transUIManager = options.transUIManager
//     this.pdfTransPage = options.pdfTransPage
//     this.pdfPage = options.pdfPage
//     this._status = OCRStatus.NONE
//     this.tippyInstance = null
//     this.div = null
//     this.abortController = null
//     this.cancelled = false
//     this.onAppend = options.onAppend || null
//   }

//   private readonly statusConfigs = {
//     [OCRStatus.NONE]: {
//       icon: OCRIcon,
//     },
//     [OCRStatus.OCRING]: {
//       icon: `<span class="animate-spin-icon">${Loading1Icon}</span>`,
//       className: 'ocrLoading',
//     },
//     [OCRStatus.OCR_SUCCESS]: {
//       icon: OCRIcon,
//       className: 'ocrSuccess',
//     },
//     [OCRStatus.OCR_FAILED]: {
//       icon: OCRIcon,
//       className: 'ocrFailed',
//     },
//   }

//   get status() {
//     return this._status
//   }

//   private createTooltip() {
//     if (!this.div) {
//       return
//     }
//     if (this.tippyInstance) {
//       this.tippyInstance.destroy()
//       this.tippyInstance = null
//     }
//     const { i18n } = this.pdfViewer
//     this.tippyInstance = tippy(this.div, {
//       content: i18n.orcTooltip || 'ocr',
//       placement: 'top',
//       arrow: true,
//       interactive: true,
//       theme: 'custom',
//       maxWidth: 258,
//       animation: 'customFade',
//       appendTo: () => document.body,
//     })
//   }

//   updateStatus(status: OCRStatus) {
//     const ocrButton = this.div
//     if (!ocrButton) {
//       return
//     }
//     if (status === OCRStatus.NONE) {
//       this.tippyInstance?.enable()
//     } else {
//       this.tippyInstance?.disable()
//     }
//     ocrButton.className = 'orcBtn'
//     ocrButton.innerHTML = ''
//     const { icon, className } = this.statusConfigs[status] as {
//       icon?: string
//       className?: string
//     }
//     if (icon) {
//       ocrButton.innerHTML = icon
//     }
//     if (className) {
//       ocrButton.classList.add(className)
//     }
//     this._status = status
//   }

//   private canvasToBlob = (
//     canvas: HTMLCanvasElement,
//     imageType: 'png' | 'jpeg' = 'png',
//   ) => {
//     return new Promise<Blob>((resolve, reject) => {
//       canvas.toBlob(
//         (blob) => {
//           if (blob) {
//             resolve(blob)
//           } else {
//             reject(new Error('Canvas to Blob conversion failed'))
//           }
//         },
//         `image/${imageType}`,
//         1.0,
//       )
//     })
//   }

//   private async getOCRImageFile(imageType: 'png' | 'jpeg' = 'png') {
//     const { pdfPage } = this
//     const viewport = pdfPage.getViewport({ scale: 1 })
//     const canvas = document.createElement('canvas')

//     const devicePixelRatio =
//       window.devicePixelRatio || PixelsPerInch.PDF_TO_CSS_UNITS
//     canvas.width = viewport.width * devicePixelRatio
//     canvas.height = viewport.height * devicePixelRatio

//     const ctx = canvas.getContext('2d')
//     const renderTask = pdfPage.render({
//       canvasContext: ctx!,
//       transform: [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0],
//       viewport,
//     })
//     await renderTask.promise
//     const fileBlob = await this.canvasToBlob(canvas, imageType)
//     return {
//       width: canvas.width,
//       height: canvas.height,
//       scale: devicePixelRatio,
//       fileBlob,
//     }
//   }

//   private async fetchOCR() {
//     if (this._status !== OCRStatus.NONE) {
//       if (this._status === OCRStatus.OCR_SUCCESS) {
//         this.abortController?.abort()
//       }
//       return
//     }
//     const { fileBlob, ...options } = await this.getOCRImageFile()
//     this.transUIManager.ocr(fileBlob, {
//       ...options,
//       pageNumber: this.id,
//     })
//   }

//   render() {
//     if (this.cancelled) {
//       return
//     }
//     const btn = (this.div = document.createElement('button'))
//     btn.hidden = true
//     this.onAppend?.(btn)
//     this.createTooltip()
//     this.show()
//   }

//   cancel() {
//     this.cancelled = true
//     if (!this.div) {
//       return
//     }
//     this.tippyInstance?.destroy()
//     this.tippyInstance = null
//     this.abortController?.abort()
//     this.abortController = null
//     this.div = null
//     this.onAppend = null
//   }

//   hide() {
//     if (!this.div || this.div.hidden) {
//       return
//     }
//     this.div.hidden = true
//     this.abortController?.abort()
//     this.abortController = null
//   }

//   private async updateOCRStatus() {
//     if (this._status !== OCRStatus.NONE) {
//       return
//     }
//     const isOCRData = await this.transUIManager.isOCR(this.id)
//     if (isOCRData) {
//       this.updateStatus(OCRStatus.OCR_SUCCESS)
//     } else {
//       this.updateStatus(OCRStatus.NONE)
//     }
//   }

//   async show() {
//     if (!this.pdfViewer.isCompareMode) {
//       this.hide()
//       return
//     }
//     this.updateOCRStatus()
//     if (!this.div || !this.div.hidden) {
//       return
//     }
//     const abortController = (this.abortController = new AbortController())
//     this.div.hidden = false
//     this.div.addEventListener('click', this.fetchOCR.bind(this), {
//       signal: abortController.signal,
//     })
//   }
// }
