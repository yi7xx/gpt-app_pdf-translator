import { useWidgetProps, useWidgetState } from '@/hooks/openai'
import {
  createContext,
  FC,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

interface TranslatorContextType {
  fileUrl: string
  setFileUrl: (fileUrl: string) => void
}

const TranslatorContext = createContext<TranslatorContextType | null>(null)

export const useTranslatorContext = () => {
  const context = useContext(TranslatorContext)
  if (!context) {
    throw new Error(
      'useTranslatorContext must be used within a TranslatorProvider',
    )
  }
  return context
}

interface Props {
  children: React.ReactNode
}

export const TranslatorProvider: FC<Props> = ({ children }) => {
  const [fileUrl, _setFileUrl] = useState<string>('')
  const widgetProps = useWidgetProps<{ fileUrl: string }>({ fileUrl: '' })
  const [widgetState, setWidgetState] = useWidgetState({
    fileUrl: '',
  })

  const setFileUrl = useCallback(
    (fileUrl: string) => {
      _setFileUrl(fileUrl)
      setWidgetState({ fileUrl: Math.random().toString() + '.pdf' })
    },
    [setWidgetState],
  )

  const providerValue = useMemo(
    () => ({ fileUrl, setFileUrl }),
    [fileUrl, setFileUrl],
  )

  return (
    <TranslatorContext.Provider value={providerValue}>
      {children}
    </TranslatorContext.Provider>
  )
}
