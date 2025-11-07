import * as React from 'react'
import { jsx } from 'react/jsx-runtime'

interface IconProps extends React.SVGProps<SVGSVGElement> {
  color?: string
  size?: string | number
}

const LoadingBase: React.FC<IconProps> = ({
  color = 'currentColor',
  size = '1em',
  ...props
}) => {
  React.useId()
  return /* @__PURE__ */ jsx('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    fill: color,
    viewBox: '0 0 60 60',
    ...props,
    children: /* @__PURE__ */ jsx('path', {
      fillRule: 'evenodd',
      d: 'M37.628 6.08a2.25 2.25 0 0 1-2.685 1.707c-9.445-2.105-19.554 2.02-24.645 10.838-5.092 8.819-3.61 19.636 2.936 26.763A2.25 2.25 0 1 1 9.92 48.43C2.083 39.898.298 26.945 6.4 16.375S24.613.875 35.922 3.395a2.25 2.25 0 0 1 1.706 2.685m9.273 5.353a2.25 2.25 0 0 1 3.179.136c7.837 8.533 9.621 21.486 3.519 32.056s-18.213 15.5-29.521 12.98a2.25 2.25 0 0 1 .979-4.392c9.444 2.105 19.553-2.019 24.645-10.838s3.609-19.635-2.937-26.762a2.25 2.25 0 0 1 .136-3.18',
      clipRule: 'evenodd',
    }),
  })
}
const Loading = React.memo(LoadingBase)

export { Loading as default }
