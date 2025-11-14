'use client'

import { baseURL } from '@/baseUrl'
import GPTButton from '@/components/GPTButton'
import {
  PDFDocument,
  PDFForwardRef,
  ScaleMode,
  SiderBar,
  ToolBar,
} from '@/components/pdfViewer'
import { useService } from '@/hooks/pdfService/useService'
import useI18n from '@/hooks/useI18n'
import { Download, Loading } from '@/packages/icons'
import { cn } from '@/utils/cn'
import { Tooltip } from 'antd'
import { PDFDocumentProxy } from 'pdfjs-dist'
import { FC, useEffect, useRef, useState } from 'react'
import { useTranslatorContext } from '../context/TranslatorContext'

interface Props {
  className?: string
}
const PDFViewer: FC<Props> = ({ className }) => {
  const { fileUrl, isFileExpired, refreshFileUrl, openFileToWisebase } =
    useTranslatorContext()
  const { translateServices, translatorStorage, ocrService } = useService()
  const pdfRef = useRef<PDFForwardRef>(null)
  const { t, i18n } = useI18n()

  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // 需要实时检查文件是否过期
    if (!isFileExpired) {
      return
    }
    setIsLoading(true)
    refreshFileUrl().then(() => {
      setIsLoading(false)
    })
  }, [fileUrl, isFileExpired, refreshFileUrl])

  const onDocumentLoaded = (pdf: PDFDocumentProxy) => {}

  const handleDownload = () => {
    openFileToWisebase()
  }

  if (isLoading || isFileExpired) {
    return (
      <div className="bg-grey-layer2-normal flex-center m-3 h-full overflow-hidden rounded-[8px]">
        <span className="text-brand-primary-normal">
          <Loading size={32} className="animate-spin" />
        </span>
      </div>
    )
  }

  return (
    <div className={cn('size-full', className)}>
      <PDFDocument
        ref={pdfRef}
        fileName={'test.pdf'}
        defaultScale={ScaleMode.PAGE_WIDTH}
        toolBar={
          <ToolBar
            backNode={null}
            extraNode={
              <Tooltip
                title={t('pdfViewer.common.open-sider-and-download')}
                arrow={false}
              >
                <GPTButton
                  variant="text"
                  icon={<Download size={20} />}
                  onClick={handleDownload}
                />
              </Tooltip>
            }
          />
        }
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
        defaultTranslateServerInfo={{
          toLang: i18n.language,
        }}
      />
    </div>
  )
}

export default PDFViewer
