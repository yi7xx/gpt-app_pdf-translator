'use client'

import { useWidgetProps } from '@/hooks/openai'
import i18n from '@/i18n'
import { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'

const ListenLanguageChange = () => {
  const props = useWidgetProps<{ language: string }>()
  useEffect(() => {
    if (props?.language) {
      i18n.changeLanguage(props.language)
    }
  }, [props?.language])
  return null
}

const I18nInitial = ({ children }: { children: React.ReactNode }) => {
  return (
    <I18nextProvider i18n={i18n}>
      <ListenLanguageChange />
      {children}
    </I18nextProvider>
  )
}

export default I18nInitial
