import typography from '@tailwindcss/typography'
import tailwindScrollbar from 'tailwind-scrollbar'
import type { Config } from 'tailwindcss'
import createPlugin from 'tailwindcss/plugin'

const config: Config = {
  plugins: [
    typography,
    tailwindScrollbar,
    createPlugin(function ({ addUtilities, matchUtilities }) {
      // 字体生成配置 11 ～ 24px
      const fontWeights = {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        extrabold: 800,
      }
      const utilities: Record<string, Record<string, string>> = {}
      for (let size = 11; size <= 24; size++) {
        const lineHeight = size <= 14 ? size + 6 : size + 8
        Object.entries(fontWeights).forEach(([weight, fontWeight]) => {
          const className = `.font-${weight}-${size}`
          utilities[className] = {
            'font-size': `${size}px`,
            'line-height': `${lineHeight}px`,
            'font-style': 'normal',
            // 注意: 使用每个项目的 --font-family
            'font-family': 'var(--font-family)',
            'font-weight': `${fontWeight}`,
          }
        })
      }

      addUtilities({
        ...utilities,
      })

      addUtilities({
        '.inline-flex-center': {
          display: 'inline-flex',
          'justify-content': 'center',
          'align-items': 'center',
        },
        '.w-stretch': {
          width: 'stretch',
        },
        '.f-center': {
          display: 'flex',
          'justify-content': 'center',
          'align-items': 'center',
          'flex-direction': 'column',
        },
        '.f-i-center': {
          display: 'flex',
          'align-items': 'center',
        },
        '.flex-center': {
          display: 'flex',
          'justify-content': 'center',
          'align-items': 'center',
        },
        '.flex-between': {
          display: 'flex',
          'justify-content': 'space-between',
        },
        '.flex-around': {
          display: 'flex',
          'justify-content': 'space-around',
        },
        '.flex-evenly': {
          display: 'flex',
          'justify-content': 'space-evenly',
        },
        '.flex-justify': {
          display: 'flex',
          'justify-content': 'center',
        },
        '.flex-align': {
          display: 'flex',
          'align-items': 'center',
        },
        '.ab-vertical-center': {
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
        },
      })
      // tailwindcss 缺失的 utility（直觉上应该有但是没有）
      addUtilities({
        /**
         * 默认配置中
         * `border` 却表示 `border-width: 1px`
         * `outline` 表示  `outline-style: solid`
         */
        '.outline-solid': {
          'outline-style': 'solid',
        },

        '.border-t-solid': {
          'border-top-style': 'solid',
        },
        '.border-r-solid': {
          'border-right-style': 'solid',
        },
        '.border-b-solid': {
          'border-bottom-style': 'solid',
        },
        '.border-l-solid': {
          'border-left-style': 'solid',
        },
        '.border-x-solid': {
          'border-left-style': 'solid',
          'border-right-style': 'solid',
        },
        '.border-y-solid': {
          'border-top-style': 'solid',
          'border-bottom-style': 'solid',
        },
        '.border-s-solid': {
          'border-inline-start-style': 'solid',
        },
        '.border-e-solid': {
          'border-inline-end-style': 'solid',
        },

        '.divide-x-solid': {
          '& > :not([hidden]) ~ :not([hidden])': {
            'border-inline-style': 'solid',
          },
        },
        '.divide-y-solid': {
          '& > :not([hidden]) ~ :not([hidden])': {
            'border-block-style': 'solid',
          },
        },
        // https://github.com/w3c/csswg-drafts/issues/1724
        '.bg-gradient-to-start': {
          'background-image':
            'linear-gradient(to left, var(--tw-gradient-stops))',

          [`&:where([dir="rtl"], [dir="rtl"] *)`]: {
            'background-image':
              'linear-gradient(to right, var(--tw-gradient-stops))',
          },
        },
        '.bg-gradient-to-end': {
          'background-image':
            'linear-gradient(to right, var(--tw-gradient-stops))',

          [`&:where([dir="rtl"], [dir="rtl"] *)`]: {
            'background-image':
              'linear-gradient(to left, var(--tw-gradient-stops))',
          },
        },
      })
    }),
  ],
}

export default config
