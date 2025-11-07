'use client'

import {
  useDisplayMode,
  useIsChatGptApp,
  useMaxHeight,
  useRequestDisplayMode,
  useWidgetProps,
} from '@/hooks'

export default function Home() {
  const toolOutput = useWidgetProps<{
    name?: string
    result?: { structuredContent?: { name?: string } }
  }>()
  const maxHeight = useMaxHeight() ?? undefined
  const displayMode = useDisplayMode()
  const requestDisplayMode = useRequestDisplayMode()
  const isChatGptApp = useIsChatGptApp()

  const name = toolOutput?.result?.structuredContent?.name || toolOutput?.name

  return (
    <div>
      <h1 className="font-normal-15 text-brand-primary-normal">Hello World</h1>
      <div className="font-normal-16 bg-bg-primary text-blue-50">text</div>
      <a href="/custom-page" className="text-text-primary-2">
        custom page
      </a>
      <br />
      <a href="/button-demo" className="text-text-primary-1">
        button demo
      </a>
    </div>
  )
}
