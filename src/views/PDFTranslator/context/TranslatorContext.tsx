import { useCallTool, useWidgetState } from '@/hooks/openai'
import {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

interface TranslatorContextType {
  fileUrl: string
  setFileUrl: (fileUrl: string) => void
  getFileUrl: (fileId: string) => Promise<string | null>
  coverFileUrl: string
  fetchFileUrlLoading: boolean
  setCoverFileUrl: (coverFileUrl: string) => void
  setWidgetFileId: (fileId: string) => void
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
  const [fileUrl, setFileUrl] = useState<string>('')
  const [coverFileUrl, setCoverFileUrl] = useState<string>('')
  const [widgetState, setWidgetState] = useWidgetState({ fileId: '' })
  const [fetchFileUrlLoading, setFetchFileUrlLoading] = useState(false)
  const callTool = useCallTool()

  console.log(widgetState, 'widgetState')

  const setWidgetFileId = useCallback(
    (fileId: string) => {
      setWidgetState((prev) => ({ ...prev, fileId }))
    },
    [setWidgetState],
  )

  const getFileUrl = useCallback(
    async (fileId: string) => {
      try {
        const data = await callTool<{ url: string }>('fetch', {
          id: `/api/scholar-file/files/${fileId}/presign-download`,
        })
        if (!data || data?.isError) {
          return null
        }
        return data.structuredContent.response.url
      } catch (error) {
        console.error(error)
        return null
      }
    },
    [callTool],
  )

  useEffect(() => {
    ;(async () => {
      if (!widgetState.fileId || fetchFileUrlLoading) return

      if (fileUrl) return

      setFetchFileUrlLoading(true)
      const url = await getFileUrl(widgetState.fileId)
      if (url) {
        setFileUrl(url)
      }
      setFetchFileUrlLoading(false)
    })()
  }, [widgetState.fileId])

  const providerValue = useMemo(
    () => ({
      fileUrl,
      coverFileUrl,
      fetchFileUrlLoading,
      setFileUrl,
      getFileUrl,
      setCoverFileUrl,
      setWidgetFileId,
    }),
    [fileUrl, coverFileUrl, setWidgetFileId],
  )

  return (
    <TranslatorContext.Provider value={providerValue}>
      {children}
    </TranslatorContext.Provider>
  )
}
