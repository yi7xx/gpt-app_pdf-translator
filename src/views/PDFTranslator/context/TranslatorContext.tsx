import { useCallTool, useOpenExternal, useWidgetState } from '@/hooks/openai'
import { buildMatrixURL } from '@/utils/maxtrixURL'
import {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

interface TranslatorContextType {
  fileUrl: string
  setFileUrl: (fileUrl: string) => void
  getFileUrl: (fileId: string) => Promise<string | null>
  coverFileUrl: string
  fetchFileUrlLoading: boolean
  isFileExpired: boolean
  refreshFileUrl: () => Promise<void>
  setCoverFileUrl: (coverFileUrl: string) => void
  setWidgetFileState: (fileId: string, fileUrl: string) => void
  openFileToWisebase: () => void
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
  const [widgetState, setWidgetState] = useWidgetState({
    fileId: '',
    fileUrl: '',
  })
  const openExternal = useOpenExternal()
  const [coverFileUrl, setCoverFileUrl] = useState<string>('')
  const [fileUrl, setFileUrl] = useState<string>(widgetState?.fileUrl || '')
  const fetchFileUrlLoadingRef = useRef(false)
  const [_, update] = useState({})
  const callTool = useCallTool()

  const setFetchFileUrlLoading = useCallback((loading: boolean) => {
    if (fetchFileUrlLoadingRef.current === loading) return
    fetchFileUrlLoadingRef.current = loading
    update({})
  }, [])

  const setWidgetFileState = useCallback(
    (fileId: string, fileUrl: string) => {
      setWidgetState((prev) => ({ ...prev, fileId, fileUrl }))
    },
    [setWidgetState],
  )

  // 检查文件是否已经过期
  const checkFileExpired = useCallback((fileUrl: string) => {
    if (!fileUrl) return true
    const urlObj = new URL(fileUrl)
    const expiresAt = urlObj.searchParams.get('Expires') ?? ''
    const now = Date.now()
    if (!expiresAt) return true
    const expiresAtTimestamp = new Date(+expiresAt * 1000).getTime()
    return now >= expiresAtTimestamp
  }, [])

  // 文件是否过期
  const isFileExpired = checkFileExpired(fileUrl)

  // 获取文件URL
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

  const openFileToWisebase = useCallback(() => {
    if (!widgetState?.fileId) return
    const url = new URL('/wisebase/ai-inbox', window.location.href)
    url.searchParams.set('from', 'gpts-app')
    url.searchParams.set('file-id', widgetState.fileId)
    openExternal(url.toString())
  }, [widgetState?.fileId, openExternal])

  // 防止在一个事件循环中多次调用
  const refreshFileUrl = useCallback(async () => {
    if (!widgetState.fileId || fetchFileUrlLoadingRef.current) return

    const { fileId, fileUrl: widgetFileUrl } = widgetState

    if (!checkFileExpired(widgetFileUrl)) {
      setFileUrl(widgetFileUrl)
      return
    }
    setFetchFileUrlLoading(true)
    const url = await getFileUrl(fileId)
    if (url) {
      setFileUrl(url)
      setWidgetFileState(fileId, url)
    }
    setFetchFileUrlLoading(false)
  }, [
    widgetState,
    checkFileExpired,
    getFileUrl,
    setFetchFileUrlLoading,
    setWidgetFileState,
  ])

  useEffect(() => {
    refreshFileUrl()
  }, [])

  const replaceStatePath = useMemo(() => {
    if (!widgetState?.fileId) return null
    return buildMatrixURL('/wisebase/ai-inbox', [
      {
        group: 'files',
        params: { 'upload-fid': widgetState.fileId, from: 'gpts-app' },
      },
    ])
  }, [widgetState?.fileId])

  useLayoutEffect(() => {
    if (replaceStatePath) {
      history.replaceState(null, '', replaceStatePath)
    }
  }, [replaceStatePath])

  const fetchFileUrlLoading = fetchFileUrlLoadingRef.current

  const providerValue = useMemo(
    () => ({
      fileUrl,
      coverFileUrl,
      fetchFileUrlLoading,
      setFileUrl,
      getFileUrl,
      setCoverFileUrl,
      isFileExpired,
      setWidgetFileState,
      refreshFileUrl,
      openFileToWisebase,
    }),
    [
      fileUrl,
      coverFileUrl,
      fetchFileUrlLoading,
      setWidgetFileState,
      getFileUrl,
      setFileUrl,
      setCoverFileUrl,
      refreshFileUrl,
      isFileExpired,
      openFileToWisebase,
    ],
  )

  return (
    <TranslatorContext.Provider value={providerValue}>
      {children}
    </TranslatorContext.Provider>
  )
}
