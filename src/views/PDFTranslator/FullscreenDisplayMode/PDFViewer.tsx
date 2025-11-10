'use client'

import { baseURL } from '@/baseUrl'
import {
  PDFDocument,
  PDFForwardRef,
  ScaleMode,
  SiderBar,
  ToolBar,
} from '@/components/pdfViewer'
import { useService } from '@/hooks/pdfService/useService'
import { cn } from '@/utils/cn'
import { PDFDocumentProxy } from 'pdfjs-dist'
import { FC, useRef } from 'react'
import { useTranslatorContext } from '../context/TranslatorContext'

interface Props {
  className?: string
}
const PDFViewer: FC<Props> = ({ className }) => {
  const { fileUrl } = useTranslatorContext()
  const { translateServices, translatorStorage, ocrService } = useService()
  const pdfRef = useRef<PDFForwardRef>(null)

  const onDocumentLoaded = (pdf: PDFDocumentProxy) => {
    console.log('onDocumentLoaded', pdf)
  }

  return (
    <div className={cn('size-full', className)}>
      <PDFDocument
        ref={pdfRef}
        fileName={'test.pdf'}
        defaultScale={ScaleMode.PAGE_WIDTH}
        toolBar={<ToolBar backNode={null} extraNode={null} />}
        siderBar={<SiderBar />}
        file={fileUrl}
        translationStorageService={translatorStorage}
        ocrService={ocrService}
        onLoadProgress={(e) => {
          // console.log('onLoadProgress', e)
        }}
        cMapUrl={`${baseURL}/pdfjs/cmaps/`}
        standardFontDataUrl={`${baseURL}/pdfjs/standard_fonts/`}
        version="1.0.2"
        globalEnableTranslate={true}
        onDocumentLoaded={onDocumentLoaded}
        translateServices={translateServices}
        onSpreadModeChanged={(spreadMode) => {}}
        defaultTranslateServerInfo={{}}
      />
    </div>
  )
}

export default PDFViewer
