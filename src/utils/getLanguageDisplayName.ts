/**
 * 用 Intl.DisplayNames 获取语言的显示名称
 *
 * @example
 * ```ts
 * const displayName = getLanguageDisplayName('en-US', 'zh-Hans')
 * //    ^ "Chinese (Simplified)"
 * ```
 * @param displayLangCode 显示语言的语言代码，如 `"en-US"`
 * @param langCode 要显示的目标语言代码，如 `"zh-Hans"`
 * @param fallback 如果找不到对应的语言名称，使用的 fallback 类型
 *  - `"code"`：使用语言代码本身作为 fallback，如 `"zh-Hans"`
 *  - `"none"`：不使用 fallback，找不到对应的语言名称则返回 `undefined`
 * @returns 目标语言的显示名称，如 `Chinese (Simplified)`，请注意：具体返回值取决于浏览器的实现，可能会有所不同
 *
 */
/*#__NO_SIDE_EFFECTS__*/
export function getLanguageDisplayName<F extends Intl.DisplayNamesFallback = 'code'>(
  displayLangCode: string,
  langCode: string,
  fallback = 'code' as F
): F extends 'code' ? string : string | undefined {
  const displayNames = new Intl.DisplayNames([escapeLangCode(displayLangCode)], {
    type: 'language',
    // 如果找不到对应的语言名称，则使用语言代码作为 fallback
    fallback
  })
  return displayNames.of(escapeLangCode(langCode)) as F extends 'code' ? string : string | undefined
}

/**
 * 转义语言代码，避免潜在纠纷
 *
 * - 将 中文-地区 改为 中文-简繁
 */
const escapeLangCodeMap = {
  zh_CN: 'zh-Hans',
  zh_TW: 'zh-Hant',
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant'
} as Record<string, string>

/**
 * 转义语言代码为符合规范的语言代码
 * @param lang
 * @returns
 */
/*#__NO_SIDE_EFFECTS__*/
export function escapeLangCode(lang: string): string {
  return (escapeLangCodeMap[lang] ?? lang).replaceAll('_', '-')
}
