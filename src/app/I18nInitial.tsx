'use client'

import i18n from '@/i18n'
import { I18nextProvider } from 'react-i18next'

const I18nInitial = ({ children }: { children: React.ReactNode }) => {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

export default I18nInitial
