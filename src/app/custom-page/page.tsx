'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next';

export default function HomePage() {
  const { t } = useTranslation();
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center gap-16 p-8 pb-20 font-sans sm:p-20">
      <main className="row-start-2 flex flex-col items-center gap-[32px] sm:items-start">
        <h1 className="text-4xl font-black tracking-tight">{t('quiz.title')}</h1>
        <p className="max-w-xl text-center font-mono text-sm/6 tracking-[-.01em] sm:text-left">
          This is a client-side rendered page demonstrating navigation in your
          ChatGPT app.
        </p>
        <Link
          href="/"
          className="bg-foreground text-background flex h-10 items-center justify-center gap-2 rounded-full border border-solid border-transparent px-4 text-sm font-medium transition-colors hover:bg-[#383838] sm:h-12 sm:px-5 sm:text-base dark:hover:bg-[#ccc]"
        >
          Go to the main page
        </Link>
      </main>
    </div>
  )
}
