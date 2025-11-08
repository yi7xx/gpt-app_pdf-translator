'use client'

import useI18n from '@/hooks/useI18n'
import { Tooltip } from 'antd'

export default function HomePage() {
  const { t } = useI18n()
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center gap-16 p-8 pb-20 font-sans sm:p-20">
      <main className="row-start-2 flex flex-col items-center gap-[32px] sm:items-start">
        <h1 className="text-4xl font-black tracking-tight">
          {t('pdfViewer.tools.cost-advanced', {
            count: () => (
              <Tooltip
                title={t('pdfViewer.tools.cost-tooltip')}
                styles={{
                  body: { textAlign: 'center', fontWeight: '400' },
                }}
              >
                <span className="text-brand-primary-normal cursor-pointer text-[12px] font-[700]">
                  {100}
                </span>
              </Tooltip>
            ),
          })}
        </h1>
        <p className="max-w-xl text-center font-mono text-sm/6 tracking-[-.01em] sm:text-left">
          This is a client-side rendered page demonstrating navigation in your
          ChatGPT app.
        </p>
        <a
          href="/"
          className="bg-foreground text-background flex h-10 items-center justify-center gap-2 rounded-full border border-solid border-transparent px-4 text-sm font-medium transition-colors hover:bg-[#383838] sm:h-12 sm:px-5 sm:text-base dark:hover:bg-[#ccc]"
        >
          Go to the main page
        </a>
      </main>
    </div>
  )
}
