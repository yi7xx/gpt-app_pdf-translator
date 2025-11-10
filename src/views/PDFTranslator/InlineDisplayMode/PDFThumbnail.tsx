'use client'

import pdfjsLib from '@/components/pdfViewer/libs/pdf'
import { PixelsPerInch } from '@/components/pdfViewer/utils/display'
import { Loading } from '@/packages/icons'
import { cn } from '@/utils/cn'
import { PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist'
import { FC, useEffect, useRef, useState } from 'react'

interface PDFThumbnailProps {
  fileUrl: string
  className?: string
  width?: number
  height?: number
}

const PDFThumbnail: FC<PDFThumbnailProps> = ({
  fileUrl,
  className = '',
  width = 300,
  height,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingPDF, setLoadingPDF] = useState(true)

  const pdfLoadingTask = useRef<PDFDocumentLoadingTask | null>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)

  const loadPDF = async () => {
    if (!fileUrl || !canvasRef.current || !containerRef.current) return

    if (pdfLoadingTask.current) return

    const width = containerRef.current.clientWidth

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

      const canvas = canvasRef.current
      const context = canvas.getContext('2d', {
        alpha: false,
        willReadFrequently: false,
      })
      if (!context) {
        throw new Error('Canvas context not available')
      }

      const viewport = page.getViewport({ scale: 1 })
      const scale = width / viewport.width
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
    } catch (err) {
      console.error('Error rendering PDF thumbnail:', err)
      setError(err instanceof Error ? err.message : 'Failed to load PDF')
    } finally {
      setLoadingPDF(false)
    }
  }

  useEffect(() => {
    loadPDF()
  }, [fileUrl])

  return (
    <div ref={containerRef} className={cn('size-full bg-white', className)}>
      {loadingPDF && (
        <div className="flex-center m-3 size-full overflow-hidden">
          <span className="text-brand-primary-normal">
            <Loading size={32} className="animate-spin" />
          </span>
        </div>
      )}
      {error && (
        <div
          className="flex-center size-full bg-red-50"
          style={{ width, height: height || width * 1.414 }}
        >
          <div className="text-red-500">Error: {error}</div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={cn({
          'block h-auto w-full': !loadingPDF && !error,
          hidden: loadingPDF || error,
        })}
      />
    </div>
  )
}

export default PDFThumbnail
