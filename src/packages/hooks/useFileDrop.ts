import { useEventListener, useLatest } from 'ahooks'
import type { Target } from 'ahooks/lib/useEventListener'
import { useEffect, useRef, useState } from 'react'

type LiteralUnion<T, U = string> = T | (U & Record<never, never>)

type FileAccept = LiteralUnion<
  | 'image/*'
  | 'audio/*'
  | 'video/*'
  | 'image/avif'
  | 'image/gif'
  | 'image/jpeg'
  | 'image/png'
  | 'video/mp4'
  | 'application/pdf'
  | 'application/zip'
>

const mimeAccept = (
  fileMimeType: string,
  acceptMimeTypes: string | string[],
) => {
  const acceptedFilesArray = Array.isArray(acceptMimeTypes)
    ? acceptMimeTypes
    : acceptMimeTypes.split(',')

  const mimeType = fileMimeType.toLowerCase()
  const baseMimeType = mimeType.replace(/\/.*$/, '')

  return acceptedFilesArray.some((type) => {
    const validType = type.trim().toLowerCase()
    if (validType.endsWith('/*')) {
      // This is something like a image/* mime type
      return baseMimeType === validType.replace(/\/.*$/, '')
    }
    return mimeType === validType
  })
}

const enum ErrorCode {
  FileInvalidType = 'file-invalid-type',
  FileTooLarge = 'file-too-large',
  FileTooSmall = 'file-too-small',
  TooManyFiles = 'too-many-files',
}

type FileError = {
  message: string
  code: ErrorCode | string
}

type FileRejection = {
  file: File | File[]
  error: FileError
}

type FileDropOptions = {
  /** 接受的文件类型，只支持 MIME 类型，不支持 `.ext` 后缀类型 */
  accept?: FileAccept[]
  /** 最大文件大小 */
  maxSize?: number
  /** 最小文件大小 */
  minSize?: number
  /** 是否支持多文件上传 */
  multiple?: boolean
  /** 最多上传文件数量 */
  maxFiles?: number
  /** 接受文件回调 */
  onDropAccepted?: (files: File[] | null) => void
  /** 因为 accpect 或者 size 不正确导致失败回调 */
  onDropRejected?: (files: FileRejection[]) => void
  /** 是否允许点击 */
  noClick?: boolean
  onSelectBefore?: () => boolean
}

type FileDropReturn = {
  /** 是否正确的 file 类型 */
  isDragAccept: boolean
  /** 是否错误的 file 类型 */
  isDragReject: boolean
  /** is over drop zone */
  isDragActive: boolean
  /** 打开文件选择框 */
  open: () => void
}

/**
 * 将一个 DOM 元素变成文件投放区域，支持拖拽和点击上传
 * @param dropElement 投放区域 DOM 元素
 * @param options 配置
 * @example
 * ```tsx
 * const {
 *   isDragAccept,
 *   isDragReject,
 * } = useFileDrop(dropElementRef, { accept: ['image/*'] })
 * ```
 */
export function useFileDrop(
  dropElement: Target,
  options: FileDropOptions,
): FileDropReturn {
  const {
    accept,
    maxSize,
    minSize,
    noClick,
    multiple,
    maxFiles,
    onDropAccepted,
    onDropRejected,
    onSelectBefore,
  } = options

  const [isDragAccept, setIsDragAccept] = useState(false)
  const [isDragReject, setIsDragReject] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const onDropAcceptedRef = useLatest(onDropAccepted)
  const onDropRejectedRef = useLatest(onDropRejected)
  const noClickRef = useLatest(noClick)

  function open() {
    inputRef.current?.click()
  }

  // 处理文件
  const dropFiles = useLatest((files: File[]) => {
    const fileRejections: FileRejection[] = []

    if (maxFiles && files.length > maxFiles) {
      fileRejections.push({
        file: files,
        error: {
          code: ErrorCode.TooManyFiles,
          message: 'many too files',
        },
      })
    } else {
      for (const file of files) {
        if (accept && !mimeAccept(file.type, accept)) {
          fileRejections.push({
            file,
            error: {
              code: ErrorCode.FileInvalidType,
              message: 'Invalid file type',
            },
          })
        } else if (maxSize !== undefined && file.size > maxSize) {
          fileRejections.push({
            file,
            error: {
              code: ErrorCode.FileTooLarge,
              message: 'File is too large',
            },
          })
        } else if (minSize !== undefined && file.size < minSize) {
          fileRejections.push({
            file,
            error: {
              code: ErrorCode.FileTooSmall,
              message: 'File is too small',
            },
          })
        }
      }
    }

    const fileAccepted = files.length > 0 && !fileRejections.length
    const fileRejected = files.length > 0 && !!fileRejections.length

    if (fileRejected) {
      onDropRejectedRef.current && onDropRejectedRef.current(fileRejections)
    } else if (fileAccepted) {
      onDropAcceptedRef.current && onDropAcceptedRef.current(files)
    }
  })

  // dragenter, 阻止默认事件，设置状态
  useEventListener(
    'dragenter',
    (e: DragEvent) => {
      e.preventDefault()
      const items = Array.from(e.dataTransfer?.items ?? [])
      const fileAccepted =
        items.length > 0 &&
        !!accept &&
        accept.length !== 0 &&
        items.some(
          (item) => item.kind === 'file' && mimeAccept(item.type, accept),
        )
      setIsDragActive(fileAccepted)
      setIsDragAccept(fileAccepted)
      setIsDragReject(items.length > 0 && !fileAccepted)
    },
    { target: dropElement },
  )

  // dragover, 阻止默认事件，允许 drop
  useEventListener(
    'dragover',
    (e: DragEvent) => {
      // prevent default to allow drop
      e.preventDefault()
    },
    { target: dropElement },
  )

  // dragleave, 清除状态
  useEventListener(
    'dragleave',
    (e: DragEvent) => {
      e.preventDefault()
      const currentTarget = e.currentTarget
      if (!(currentTarget instanceof Element)) return
      if (
        ![e.relatedTarget, e.target].some(
          (item) => item instanceof Element && !currentTarget.contains(item),
        )
      ) {
        return
      }
      setIsDragActive(false)
      setIsDragAccept(false)
      setIsDragReject(false)
    },
    { target: dropElement },
  )

  // drop, 处理文件
  useEventListener(
    'drop',
    (e: DragEvent) => {
      e.preventDefault()
      setIsDragActive(false)
      setIsDragAccept(false)
      setIsDragReject(false)
      const files = Array.from(e.dataTransfer?.files ?? [])

      dropFiles.current(files)
    },
    { target: dropElement },
  )

  useEventListener('click', (e: MouseEvent) => {
    // 兜底, 但未触发 dragleave时
    if (isDragActive) {
      setIsDragActive(false)
    }
  })

  // click to select file
  useEventListener(
    'click',
    () => {
      if (noClickRef.current) return
      if (onSelectBefore && !onSelectBefore?.()) return
      open()
    },
    { target: dropElement },
  )

  // blur, 清除状态
  useEventListener(
    'blur',
    () => {
      setIsDragActive(false)
      setIsDragAccept(false)
      setIsDragReject(false)
    },
    { target: window },
  )

  // create input element, let user click to select file
  useEffect(() => {
    inputRef.current = document.createElement('input')
    inputRef.current.type = 'file'
    inputRef.current.accept = accept?.join(',') || '*'
    inputRef.current.multiple = multiple ?? false

    inputRef.current.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement
      const files = Array.from(target.files ?? [])
      dropFiles.current(files)
      target.value = ''
    })

    return () => {
      inputRef.current = null
    }
  }, [])

  return {
    isDragAccept,
    isDragReject,
    isDragActive,
    open,
  }
}
