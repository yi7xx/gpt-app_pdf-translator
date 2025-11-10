'use client'

import GPTSkeleton from '@/components/GPTSkeleton'
import { useDisplayMode } from '@/hooks/openai'
import useMounted from '@/hooks/useMounted'
import FullscreenDisplayMode from './FullscreenDisplayMode'
import InlineDisplayMode from './InlineDisplayMode'
import { TranslatorProvider } from './context/TranslatorContext'

const PDFTranslator = () => {
  const isMounted = useMounted()
  const displayMode = useDisplayMode() ?? 'inline'
  if (!isMounted) {
    return <GPTSkeleton className="h-85 w-full" />
  }

  return (
    <TranslatorProvider>
      {displayMode === 'fullscreen' && <FullscreenDisplayMode />}
      {displayMode === 'inline' && <InlineDisplayMode />}
    </TranslatorProvider>
  )
}

export default PDFTranslator
