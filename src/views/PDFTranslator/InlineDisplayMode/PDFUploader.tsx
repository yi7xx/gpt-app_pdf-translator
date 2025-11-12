import GPTButton from '@/components/GPTButton'
import { useCallTool } from '@/hooks/openai'
import useI18n from '@/hooks/useI18n'
import {
  ArrowRotateCw,
  CloseOutlineS,
  ExclamationMarkCircleFilledError,
  UploadDocuments,
} from '@/packages/icons'
import { FileItem } from '@/types/file'
import { cn } from '@/utils/cn'
import { useFileDrop } from '@sider/hooks'
import { useEffect, useRef, useState } from 'react'
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
  const callTool = useCallTool()

  const {
    fileUrl,
    fetchFileUrlLoading,
    setFileUrl,
    getFileUrl,
    setWidgetFileState,
  } = useTranslatorContext()
  const [status, setStatus] = useState<UploaderStatus>(() =>
    fileUrl ? UploaderStatus.COMPLETED : UploaderStatus.IDLE,
  )

  useEffect(() => {
    if (fileUrl || fetchFileUrlLoading) {
      setStatus(UploaderStatus.COMPLETED)
    }
  }, [fileUrl, fetchFileUrlLoading])

  // 获取文件签名
  const getFileSignature = async (file: File) => {
    const data = await callTool<{ file: FileItem; upload_url: string }>(
      'fetch',
      {
        id: '/api/scholar-file/files/presign-upload',
        method: 'POST',
        payload: {
          fileName: file.name,
          content_type: file.type,
        },
      },
    )
    if (!data || data?.isError) {
      return null
    }
    return data.structuredContent.response
  }

  // 上传文件
  const uploadFile = async (file: File, uploadUrl: string) => {
    setUploadProgress(0)

    const uploadPromise = new Promise(async (resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(percent)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          resolve(xhr.response)
        } else {
          reject(new Error(`Failed to upload file ${xhr.statusText}`))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Failed to upload file'))
      })

      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    })

    return uploadPromise
  }

  const fileRef = useRef<File | null>(null)
  const processUpload = async (file: File) => {
    fileRef.current = file
    setStatus(UploaderStatus.UPLOADING)
    setUploadProgress(0)

    const signature = await getFileSignature(file)

    if (!signature) {
      setStatus(UploaderStatus.ERROR)
      return
    }

    const { file: fileItem, upload_url: uploadUrl } = signature

    try {
      await uploadFile(file, uploadUrl)

      const fileUrl = await getFileUrl(fileItem.id)

      if (!fileUrl) {
        setStatus(UploaderStatus.ERROR)
        return
      }
      fileRef.current = null
      setFileUrl(fileUrl)
      setWidgetFileState(fileItem.id, fileUrl)
      setStatus(UploaderStatus.COMPLETED)
    } catch (error: any) {
      console.error(error.message, 'error')
      setStatus(UploaderStatus.ERROR)
    }
  }

  const handleRetry = () => {
    if (!fileRef.current) return
    processUpload(fileRef.current)
  }

  const { isDragActive } = useFileDrop(uploaderRef, {
    accept: ['application/pdf'],
    onDropAccepted: (files) => {
      if (files && files.length > 0) {
        processUpload(files[0])
      }
    },
  })

  if (status === UploaderStatus.IDLE) {
    return (
      <div className="bg-bg-primary h-85 w-full p-4" ref={uploaderRef}>
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
      <div className="bg-bg-primary h-85 w-full p-4">
        <div className="flex-center border-border-light bg-interactive-bg-secondary-default size-full flex-col gap-6 rounded-xl border">
          <div className="f-i-center flex-col gap-2">
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
    return <PDFPreview className="h-105" />
  }

  return (
    <div className="bg-bg-primary h-85 w-full p-4">
      <div className="flex-center border-border-light bg-interactive-bg-secondary-default size-full flex-col gap-4 rounded-xl border">
        <ExclamationMarkCircleFilledError size={24} />
        <span className="font-normal-14 text-text-secondary">
          {t('pdfUploader.upload-failed')}
        </span>
        <div className="inline-flex gap-2">
          <GPTButton
            className="gap-1"
            variant="secondary"
            icon={<CloseOutlineS size={20} />}
            onClick={() => setStatus(UploaderStatus.IDLE)}
          >
            {t('pdfUploader.cancel')}
          </GPTButton>
          <GPTButton
            className="gap-1"
            variant="secondary"
            icon={<ArrowRotateCw size={20} />}
            onClick={handleRetry}
          >
            {t('pdfUploader.retry')}
          </GPTButton>
        </div>
      </div>
    </div>
  )
}

export default PDFUploader
