import useI18n from '@/hooks/useI18n'
import { UploadDocuments } from '@/packages/icons'
import { cn } from '@/utils/cn'
import { useFileDrop } from '@sider/hooks'
import { useRef, useState } from 'react'
import { useTranslatorContext } from '../context/TranslatorContext'
import PDFPreview from './PDFPreview'

enum UploaderStatus {
  IDLE = 'idle',
  UPLOADING = 'uploading',
  COMPLETED = 'completed',
  ERROR = 'error',
}

const PDFUploader = () => {
  const { t } = useI18n()
  const uploaderRef = useRef<HTMLDivElement>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const { fileUrl, setFileUrl } = useTranslatorContext()
  const [status, setStatus] = useState<UploaderStatus>(() =>
    fileUrl ? UploaderStatus.COMPLETED : UploaderStatus.IDLE,
  )

  const simulateUpload = async (file: File) => {
    setStatus(UploaderStatus.UPLOADING)
    setUploadProgress(0)

    const totalSteps = 20
    for (let i = 0; i <= totalSteps; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      setUploadProgress(Math.round((i / totalSteps) * 100))
    }

    const blobUrl = URL.createObjectURL(file)
    setFileUrl(blobUrl)
    setStatus(UploaderStatus.COMPLETED)
  }

  const { isDragActive } = useFileDrop(uploaderRef, {
    accept: ['application/pdf'],

    onDropAccepted: (files) => {
      if (files && files.length > 0) {
        simulateUpload(files[0])
      }
    },
  })

  if (status === UploaderStatus.IDLE) {
    return (
      <div className="h-85 w-full p-4" ref={uploaderRef}>
        <div
          className={cn(
            'border-border-light flex-center relative size-full cursor-pointer flex-col gap-4 rounded-xl border',
            'bg-interactive-bg-secondary-default hover:bg-interactive-bg-secondary-hover transition-colors',
          )}
        >
          <UploadDocuments size={24} />
          <div className="f-i-center flex-col gap-1.5">
            <span className="font-semibold-16 text-text-primary -tracking-[0.4px]">
              {t('pdfUploader.clickOrDrag')}
            </span>
            <span className="font-normal-14 text-text-tertiary -tracking-[0.3px]">
              {t('pdfUploader.supportedFormats')}
            </span>
          </div>
          {isDragActive && (
            <div className="flex-center bg-bg-scrim absolute inset-0 rounded-xl backdrop-blur-[10px]">
              <div className="font-semibold-16 text-text-primary -tracking-[0.4px]">
                {t('pdfUploader.dragFileHere')}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (status === UploaderStatus.UPLOADING) {
    return (
      <div className="h-85 w-full p-4">
        <div className="flex-center border-border-light bg-interactive-bg-secondary-default size-full flex-col gap-6 rounded-xl border">
          <div className="f-i-center gap-2">
            <span className="font-semibold-24 text-text-primary -tracking-[0.25px]">
              {uploadProgress} %
            </span>
            <span className="font-normal-14 text-text-tertiary -tracking-[0.3px]">
              {t('pdfUploader.uploading')}
            </span>
          </div>
          <div className="bg-bg-tertiary relative h-1.5 w-45 rounded-full">
            <div
              className="bg-icon-primary absolute start-0 top-0 h-full rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  if (status === UploaderStatus.COMPLETED) {
    return <PDFPreview fileUrl={fileUrl} className="h-105" />
  }

  return <div className="error"></div>
}

export default PDFUploader
