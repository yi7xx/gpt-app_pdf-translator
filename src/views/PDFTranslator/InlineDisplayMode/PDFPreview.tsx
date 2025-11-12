import GPTButton from '@/components/GPTButton'
import { useRequestDisplayMode } from '@/hooks/openai'
import useI18n from '@/hooks/useI18n'
import { cn } from '@/utils/cn'
import { ExpandSm } from '@sider/icons'
import { FC } from 'react'
import PDFThumbnail from './PDFThumbnail'

interface Props {
  className?: string
}

const PDFPreview: FC<Props> = ({ className }) => {
  const { t } = useI18n()
  const requestDisplayMode = useRequestDisplayMode()
  const handleExpand = async () => {
    const { mode } = await requestDisplayMode('fullscreen')
    if (mode === 'fullscreen') {
      // something ...
    }
  }
  return (
    <div className={cn('relative size-full overflow-hidden', className)}>
      <PDFThumbnail />
      <div className="absolute end-3 top-3 z-10">
        <button
          className="size-10 rounded-full bg-[var(--gray-0)] p-2 transition-colors hover:bg-[var(--gray-1000-a2)] active:bg-[var(--gray-1000-a5)]"
          style={{
            boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.05)',
          }}
          onClick={handleExpand}
        >
          <ExpandSm size={24} className="text-[var(--gray-1000)]" />
        </button>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 z-10 h-30"
        style={{
          background:
            'linear-gradient(180deg, rgba(244, 244, 244, 0.00) 0%, rgba(227, 227, 227, 0.50) 100%)',
        }}
      >
        <GPTButton
          className="force-light-btn absolute bottom-5 left-1/2 -translate-x-1/2"
          onClick={handleExpand}
        >
          {t('pdfUploader.fullScreen')}
        </GPTButton>
      </div>
    </div>
  )
}

export default PDFPreview
