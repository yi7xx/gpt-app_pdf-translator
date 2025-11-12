import type en from '@/locales/en.json'
import { escapeLangCode } from '@/utils/getLanguageDisplayName'
import type { ReactElement, ReactNode } from 'react'
import {
  cloneElement,
  createElement,
  Fragment,
  isValidElement,
  useMemo,
} from 'react'
import { useTranslation } from 'react-i18next'

type DeepKeys<T> =
  T extends Record<string, unknown>
    ? {
        [K in keyof T]-?: `${K & string}` | Concat<K & string, DeepKeys<T[K]>>
      }[keyof T]
    : ''

type DeepLeafKeys<T> =
  T extends Record<string, unknown>
    ? { [K in keyof T]-?: Concat<K & string, DeepKeys<T[K]>> }[keyof T]
    : ''

type Concat<
  K extends string,
  P extends string,
> = `${K}${'' extends P ? '' : '.'}${P}`

// a.b => en["a"]["b"]
type GetReturnObjectType<
  T extends string,
  Root = typeof en,
> = T extends `${infer Key}.${infer Rest}`
  ? Key extends keyof Root
    ? GetReturnObjectType<Rest, Root[Key]>
    : never
  : T extends keyof Root
    ? Root[T]
    : never

export type I18nKeys = DeepLeafKeys<typeof en>

/**
 * 匹配 <tagName>tagContent</tagName> 或 {{variable}}
 */
const TEMPLATE_REGEX =
  /<(?<tagName>\w+)>(?<tagContent>.*?)<\/\k<tagName>>|{{(?<variable>\w+)}}/g

/**
 * 增强的t函数
 * 1. 支持传入React组件进行插值
 * 2. 类似 I like <b onClick={() => null}>you</b> so much 这种也不需要拆分，同时保证翻译时语句的完整性
 * 3. 更好的ts提示，提示en-tpl.json中配置的key
 */
export default function useI18n(...args: Parameters<typeof useTranslation>) {
  const { t: _t, i18n, ready } = useTranslation(...args)

  function CustomT(key: I18nKeys): string
  function CustomT<K extends I18nKeys>(
    key: K,
    data: {
      returnObjects: true
      [K: string]: string | number | boolean
    },
  ): GetReturnObjectType<K>
  function CustomT(key: I18nKeys, data: Record<string, string>): string
  function CustomT(
    key: I18nKeys,
    data: Record<string, ((content: string) => ReactNode) | ReactNode>,
  ): ReactElement
  function CustomT(key: I18nKeys, data?: Record<string, unknown>) {
    if (data) {
      const components: Record<string, ReactElement<unknown>> = {}
      const functions: Record<string, (text: string) => ReactNode> = {}

      for (const key of Object.keys(data)) {
        const val = data[key]
        if (typeof val === 'function') {
          functions[key] = val as (text: string) => ReactNode
          delete data[key]
        } else if (isValidElement(val)) {
          components[key] = val
          delete data[key]
        }
      }
      const functionKeys = Object.keys(functions)
      const componentKeys = Object.keys(components)

      if (componentKeys.length > 0 || functionKeys.length > 0) {
        const text = _t(key, data)

        const result = []
        let lastIndex = 0

        for (const match of text.matchAll(TEMPLATE_REGEX)) {
          if (match.index === undefined) continue
          const fullMatch = match[0]
          const { tagName, tagContent, variable } = match.groups || {}
          const textBetweenMatches = text.slice(lastIndex, match.index)
          lastIndex = match.index + fullMatch.length

          // 前次匹配 到 这次匹配 之间的文本
          if (textBetweenMatches) {
            result.push(textBetweenMatches)
          }

          if (tagName) {
            if (tagName in functions) {
              result.push(functions[tagName](tagContent))
            } else if (tagName in components) {
              result.push(
                cloneElement(
                  components[tagName] as ReactElement,
                  undefined,
                  voidElements.has(tagName) ? undefined : tagContent,
                ),
              )
            } else {
              console.error(`translate error: no replacement key '${tagName}'`)
            }
          } else if (variable) {
            if (variable in components) {
              result.push(components[variable])
            } else {
              console.error(`translate error: no replacement key '${variable}'`)
            }
          }
        }

        // 剩余文本
        if (lastIndex < text.length) {
          result.push(text.slice(lastIndex))
        }

        return createElement(Fragment, null, ...result)
      }
    }

    return _t(key, data || {}) as
      | string
      | Record<string, string>
      | (string | Record<string, string>)[]
      | ReactNode
  }

  const t = useMemo(() => CustomT, [_t])
  const staticT = useMemo(() => CustomT, [])

  // FIXME: 在 srcdoc iframe 中一些情况（翻译页面后）下，i18n 未被传入是空对象?
  // useTranslation: You will need to pass in an i18next instance by using initReactI18next
  const dir = i18n.dir ? i18n.dir(i18n.language) : 'ltr'

  return {
    t,
    i18n,
    ready,
    dir,
    isLTR: dir === 'ltr',
    lang: i18n.language,
    staticT,
  }
}

/**
 * 用于类型提示，不会有任何运行时效果
 */
/*#__NO_SIDE_EFFECTS__*/
export function asI18nKey(key: I18nKeys): I18nKeys {
  return key
}

const voidElements = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

/**
 * @example
 * ```ts
 * const formatted = listFormat(['apple', 'banana', 'cherry'], 'en-US')
 * //    ^ "apple, banana, and cherry"
 * ```
 */
export function listFormat(
  list: readonly string[],
  lang: string,
  options: Intl.ListFormatOptions = { type: 'conjunction', style: 'long' },
): string {
  try {
    return new Intl.ListFormat(escapeLangCode(lang), options).format(list)
  } catch (error) {
    return list.join(', ')
  }
}
