import useI18n from '@/hooks/useI18n'
import { CloseOutlineM, Loading } from '@sider/icons'
import { Button, ConfigProvider, Modal, message, notification } from 'antd'
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
  const { t } = useI18n()
  const printContainerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const printServiceRef = useRef<PDFPrintService | null>(null)
  const showMessageRef = useRef(false)

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
        <span className="text-text-primary-1 font-medium-16">
          {t('pdfViewer.download.trans-progress', {
            current: completed,
            total: total,
          })}
        </span>
      ),
      description: (
        <span className="text-text-primary-3 font-normal-14">
          {t('pdfViewer.download.trans-progress-info')}
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
          <span className="text-text-primary-1 font-medium-16">
            {t('pdfViewer.download.trans-failed')}
          </span>
        ),
        description: (
          <div className="-mt-[4px] text-right">
            <span
              className="text-brand-secondary-normal font-medium-12 hover:text-brand-secondary-hover cursor-pointer transition-colors"
              onClick={() => {
                api.destroy()
                printService.rebuild(mode)
              }}
            >
              {t('pdfViewer.download.retry')}
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

  const printTransPDF = () => {
    if (
      !pdfViewer ||
      !pdfDocument ||
      !(pdfViewer.isTranslateMode || pdfViewer.isCompareMode)
    ) {
      message.warning(t('pdfViewer.download.not-support'), 1)
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

  return (
    <>
      <Modal
        open={open}
        width={480}
        footer={null}
        closable={false}
        title={null}
        destroyOnHidden
        styles={{
          content: {
            padding: 0,
            borderRadius: 16,
          },
        }}
      >
        <div className="relative flex flex-col gap-[24px] p-[24px]">
          <div className="absolute top-[8px] right-[8px]">
            <span
              onClick={() => setOpen(false)}
              className="bg-glass-fill1-normal text-text-white-1 flex-center hover:bg-glass-fill1-hover size-[20px] cursor-pointer rounded-[50%] backdrop-blur-[8px] transition-colors"
            >
              <CloseOutlineM size={12} />
            </span>
          </div>
          <div className="text-text-primary-2 font-normal-14">
            {t('pdfViewer.download.trans-info', {
              count: pdfViewer?.pagesCount || 0,
            })}
          </div>
          <div className="f-i-center gap-[8px]">
            <button
              onClick={() => printPDF('direct')}
              className="bg-grey-fill2-normal text-text-primary-1 font-normal-14 flex-center hover:bg-grey-fill2-hover h-[32px] flex-1 rounded-[8px] transition-colors"
            >
              {t('pdfViewer.download.direct')}
            </button>
            <Button
              onClick={() => printPDF('translate')}
              type="primary"
              className="font-normal-14 flex-1"
            >
              {t('pdfViewer.download.trans')}
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
