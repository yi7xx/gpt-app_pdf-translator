'use client'

import pdfjsLib from '@/components/pdfViewer/libs/pdf'
import { PixelsPerInch } from '@/components/pdfViewer/utils/display'
import { Loading } from '@/packages/icons'
import { cn } from '@/utils/cn'
import { PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist'
import { FC, useEffect, useRef, useState } from 'react'
import { useTranslatorContext } from '../context/TranslatorContext'

interface PDFThumbnailProps {
  className?: string
  width?: number
  height?: number
}

const PDFThumbnail: FC<PDFThumbnailProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    fileUrl,
    coverFileUrl,
    isFileExpired,
    setCoverFileUrl,
    refreshFileUrl,
  } = useTranslatorContext()

  const pdfLoadingTask = useRef<PDFDocumentLoadingTask | null>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)

  const [loadingPDF, setLoadingPDF] = useState(!coverFileUrl)
  const [error, setError] = useState<string | null>(null)

  const loadPDF = async () => {
    // 如果封面图片已经存在，则不重新加载
    if (coverFileUrl) return

    // 如果文件URL不存在，或者容器不存在，则不重新加载
    if (!fileUrl || !containerRef.current) return

    // 如果PDF加载任务已经存在，则不重新加载
    if (pdfLoadingTask.current) return

    const containerWidth = containerRef.current.clientWidth

    try {
      setLoadingPDF(true)
      setError(null)

      const loadingTask = (pdfLoadingTask.current = pdfjsLib.getDocument({
        url: fileUrl,
        cMapUrl: window.origin + '/pdfjs/cmaps/',
        standardFontDataUrl: window.origin + '/pdfjs/standard_fonts/',
      }))

      const pdf = await loadingTask.promise

      const page = await pdf.getPage(1)

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', {
        alpha: false,
        willReadFrequently: false,
      })
      if (!context) {
        throw new Error('Canvas context not available')
      }

      const viewport = page.getViewport({ scale: 1 })
      const scale = containerWidth / viewport.width
      const scaledViewport = page.getViewport({ scale })

      const devicePixelRatio =
        window.devicePixelRatio || PixelsPerInch.PDF_TO_CSS_UNITS

      const outputWidth = scaledViewport.width * devicePixelRatio
      const outputHeight = scaledViewport.height * devicePixelRatio

      canvas.width = outputWidth
      canvas.height = outputHeight

      renderTaskRef.current = page.render({
        canvasContext: context,
        transform: [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0],
        viewport: scaledViewport,
      })

      await renderTaskRef.current.promise

      const imageDataUrl = canvas.toDataURL('image/png')
      setCoverFileUrl(imageDataUrl)
    } catch (err) {
      console.error('Error rendering PDF thumbnail:', err)
      setError(err instanceof Error ? err.message : 'Failed to load PDF')
    } finally {
      setLoadingPDF(false)
    }
  }

  useEffect(() => {
    if (isFileExpired) {
      refreshFileUrl()
      return
    }
    loadPDF()
  }, [fileUrl, isFileExpired])

  let children

  if (loadingPDF || isFileExpired) {
    children = (
      <div className="flex-center size-full overflow-hidden">
        <span className="text-brand-primary-normal">
          <Loading size={32} className="animate-spin" />
        </span>
      </div>
    )
  } else if (error) {
    children = (
      <div className="flex-center size-full">
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  } else {
    children = (
      <img
        src={coverFileUrl}
        alt="PDF Thumbnail"
        className="block h-auto w-full"
      />
    )
  }

  return (
    <div ref={containerRef} className={cn('size-full bg-white', className)}>
      {children}
    </div>
  )
}

export default PDFThumbnail
