import { useMemo } from 'react'
import { FreeTranslatorService } from './FreeTranslatorService'
import { OCRTranslatorService } from './OCRTranslatorService'
import { TranslatorStorageService } from './TranslatorStorageService'

export const useService = () => {
  const free = useMemo(() => new FreeTranslatorService(), [])

  const translatorStorage = useMemo(() => new TranslatorStorageService(), [])

  const translateServices = useMemo(() => [free], [free])

  const ocrService = useMemo(() => new OCRTranslatorService(), [])

  return {
    free,
    ocrService,
    translatorStorage,
    translateServices,
  }
}
