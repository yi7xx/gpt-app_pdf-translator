'use client'

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// 使用 webpack 的 require.context 批量导入所有语言文件
const loadResources = () => {
  const resources: Record<string, { translation: any }> = {}

  // @ts-ignore - webpack require.context
  const localeContext = require.context('./locales', false, /\.json$/)

  localeContext.keys().forEach((key: string) => {
    // 从文件名提取语言代码 (例如: './en.json' -> 'en')
    const langCode = key.replace('./', '').replace('.json', '')
    const localeData = localeContext(key)

    resources[langCode] = {
      translation: localeData.default || localeData,
    }
  })

  // 添加语言代码变体映射
  if (resources['en']) {
    resources['en-US'] = resources['en']
  }
  if (resources['zh-CN']) {
    resources['zh'] = resources['zh-CN']
    resources['zh_CN'] = resources['zh-CN']
  }
  if (resources['zh-TW']) {
    resources['zh_TW'] = resources['zh-TW']
  }

  return resources
}

// 只在客户端初始化
if (!i18n.isInitialized) {
  const resources = loadResources()

  i18n.use(initReactI18next).init({
    resources,
    lng: 'en',
    fallbackLng: ['en', 'en-US'],
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false,
    },
  })
}

export default i18n
