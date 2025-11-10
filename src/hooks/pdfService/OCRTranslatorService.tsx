import {
  type OCRParams,
  type Paragraph,
  type PDFEventBus,
  OCRService,
  TranslationServiceManager,
} from '@/components/pdfViewer'

interface OCRData {
  text: string
  line_data: {
    type: string
    cnt: number[][]
    error_id?: string
    included?: boolean
    text?: string
    confidence?: number
    confidence_rate?: number
  }[]
}

export class OCRTranslatorService extends OCRService {
  private serverManager: TranslationServiceManager | null = null
  private eventBus: PDFEventBus | null

  constructor() {
    super()
    this.serverManager = null
    this.eventBus = null
  }

  inject(manager: TranslationServiceManager, eventBus: PDFEventBus) {
    this.serverManager = manager
    this.eventBus = eventBus
  }

  private convertMathpixData(
    mathpixData: any,
    pageWidth: number,
    pageHeight: number,
    scale: number,
  ): Paragraph[] {
    return mathpixData.result.line_data.map((line: any) => {
      const [x1, y1] = line.cnt[0]
      const [x2, y2] = line.cnt[1]
      const [x3, y3] = line.cnt[2]
      const [x4, y4] = line.cnt[3]

      const minX = Math.min(x1, x2, x3, x4)
      const minY = Math.min(y1, y2, y3, y4)
      const maxX = Math.max(x1, x2, x3, x4)
      const maxY = Math.max(y1, y2, y3, y4)

      // 标准化坐标
      const box: [number, number, number, number] = [
        minX / pageWidth,
        minY / pageHeight,
        (maxX - minX) / pageWidth,
        (maxY - minY) / pageHeight,
      ]

      const fontSize = (maxY - minY) / scale / 1.2

      return {
        sourceText: line.text?.replace(/\n/g, '') || '',
        text: '',
        fontSize,
        box: box,
        layoutBox: [...box],
        std: true,
        angle: 0,
        mergeLine: 0,
      }
    })
  }

  // 存在特殊的类型不处理 比如table
  private isSpecialType(mathpixData: any, types: string[]) {
    return mathpixData.result.line_data.some((line: any) =>
      types.includes(line.type),
    )
  }

  async ocr(params: OCRParams) {
    const { file, pageNumber, width, height, scale, paragraphs } = params
    return {
      isError: false,
      data: {
        paragraphs: paragraphs,
        pageNumber,
      },
    }
  }
}
