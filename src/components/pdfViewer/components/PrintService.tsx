import { CloseOutlineM, Loading } from '@sider/icons'
import { Button, ConfigProvider, Modal, message, notification } from 'antd'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { useDocumentContext } from '../context/DocumentContext'
import { PDFViewerEvent, UIEvents } from '../events'
import { usePDFEvent } from '../hooks/usePDFEvent'
import {
  PDFPrintService,
  PDFPrintServiceFactory,
} from '../modules/PDFPrintService'

export const PrintService = () => {
  const { pdfViewer, pdfDocument, docFileName, eventBus } = useDocumentContext()
  const t = useTranslations('ui.pdfViewer.download')
  const printContainerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const printServiceRef = useRef<PDFPrintService | null>(null)
  const showMessageRef = useRef(false)

  const printTransPDF = () => {
    if (
      !pdfViewer ||
      !pdfDocument ||
      !(pdfViewer.isTranslateMode || pdfViewer.isCompareMode)
    ) {
      message.warning(t('not-support'), 1)
      return
    }
    if (printServiceRef.current) {
      updateTranslating(printServiceRef.current)
      return
    }
    if (pdfViewer.transUIManager?.checkTransPagesDone()) {
      printPDF('direct')
      return
    }
    setOpen(true)
  }

  usePDFEvent(UIEvents.Print, printTransPDF)

  const [api, contextHolder] = notification.useNotification()

  const updateTranslating = (
    printService: PDFPrintService,
    showMessage: boolean = true,
  ) => {
    const { key, completed, total } = printService
    if (!showMessage || completed === total) {
      return
    }
    api.open({
      key: key,
      message: (
        <span className="text-color-text-primary-1 font-medium-16">
          {t.rich('trans-progress', {
            current: completed,
            total,
          })}
        </span>
      ),
      description: (
        <span className="text-color-text-primary-3 font-normal-14">
          {t('trans-progress-info')}
        </span>
      ),
      icon: (
        <span className="relative">
          <Loading className="animate-spin" size={20} />
        </span>
      ),
      onClose: () => {
        showMessageRef.current = false
      },
      duration: 0,
    })
  }

  const translateDone = (printService: PDFPrintService) => {
    setTimeout(() => {
      api.destroy(printService.key)
      api.destroy()
      showMessageRef.current = true
    }, 16)
  }

  const translateError = (
    printService: PDFPrintService,
    pageNumber: number,
    mode: 'direct' | 'translate',
  ) => {
    setTimeout(() => {
      api.warning({
        message: (
          <span className="text-color-text-primary-1 font-medium-16">
            {t('trans-failed')}
          </span>
        ),
        description: (
          <div className="-mt-[4px] text-right">
            <span
              className="cursor-pointer text-color-brand-secondary-normal transition-colors font-medium-12 hover:text-color-brand-secondary-hover"
              onClick={() => {
                api.destroy()
                printService.rebuild(mode)
              }}
            >
              {t('retry')}
            </span>
          </div>
        ),
        onClick: () => {
          api.destroy()
          pdfViewer?.scrollPageIntoView({
            pageNumber,
          })
        },
        duration: 0,
      })
    })
  }

  usePDFEvent(UIEvents.DownloadUpdateTranslating, ({ source }) => {
    updateTranslating(source, showMessageRef.current)
  })

  usePDFEvent(UIEvents.DownloadTranslateDone, ({ source }) => {
    translateDone(source)
  })

  usePDFEvent(
    UIEvents.DownloadTranslateError,
    ({ source, mode, pageNumber, showTooltip }) => {
      api.destroy(source.key)
      api.destroy()
      printServiceRef.current = null
      if (showTooltip) {
        translateError(source, pageNumber, mode)
      }
    },
  )

  const printPDF = (mode: 'direct' | 'translate') => {
    const printService = PDFPrintServiceFactory.createPrintService({
      eventBus,
      pdfViewer: pdfViewer!,
      pdfDocument: pdfDocument!,
      docFileName,
      printContainer: printContainerRef.current!,
      // 等待视图更新完成后进行打印
      beforePrint: () => {
        return new Promise((resolve) => setTimeout(resolve, 250 * 2))
      },
      afterPrint: () => {
        printServiceRef.current = null
      },
    })
    if (printService === null) {
      // 已经处于翻译当中
      if (printServiceRef.current) {
        updateTranslating(printServiceRef.current)
      }
      return
    }
    showMessageRef.current = true
    setOpen(false)
    printServiceRef.current = printService
    printService.prepareDownload(mode)
  }

  usePDFEvent(PDFViewerEvent.PagesDestroy, () => {
    if (printServiceRef.current) {
      api.destroy(printServiceRef.current.key)
      api.destroy()
      printServiceRef.current.destroy()
      printServiceRef.current = null
    }
  })

  return (
    <>
      <Modal
        open={open}
        width={480}
        footer={null}
        closable={false}
        title={null}
        destroyOnClose
        styles={{
          content: {
            padding: 0,
            borderRadius: 16,
          },
        }}
      >
        <div className="relative flex flex-col gap-[24px] p-[24px]">
          <div className="absolute right-[8px] top-[8px]">
            <span
              onClick={() => setOpen(false)}
              className="size-[20px] cursor-pointer rounded-[50%] bg-color-glass-fill1-normal text-color-text-white-1 backdrop-blur-[8px] transition-colors flex-center hover:bg-color-glass-fill1-hover"
            >
              <CloseOutlineM size={12} />
            </span>
          </div>
          <div className="text-color-text-primary-2 font-normal-14">
            {t.rich('trans-info', {
              count: pdfViewer?.pagesCount || 0,
            })}
          </div>
          <div className="gap-[8px] f-i-center">
            <button
              onClick={() => printPDF('direct')}
              className="h-[32px] flex-1 rounded-[8px] bg-color-grey-fill2-normal text-color-text-primary-1 transition-colors font-normal-14 flex-center hover:bg-color-grey-fill2-hover"
            >
              {t('direct')}
            </button>
            <Button
              onClick={() => printPDF('translate')}
              type="primary"
              className="flex-1 font-normal-14"
            >
              {t('trans')}
            </Button>
          </div>
        </div>
      </Modal>
      <ConfigProvider
        theme={{
          token: {
            borderRadiusLG: 16,
          },
        }}
      >
        {contextHolder}
      </ConfigProvider>
      {ReactDOM.createPortal(
        <div id="printContainer" ref={printContainerRef}></div>,
        document.body,
      )}
    </>
  )
}
