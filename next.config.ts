import type { NextConfig } from 'next'
import { baseURL } from './src/baseUrl'

const createSvgTemplate = (variables: any, { tpl }: any) => {
  return tpl`
      ${variables.imports};
      ${variables.interfaces};
      const ${variables.componentName} = (${variables.props}) => {
        const { size, color, ...newProps } = props
        if (size) {
          newProps.width = size;
          newProps.height = size;
        }
        if (color) {
          newProps.fill = color;
        }
        props = { ...newProps };
        return (${variables.jsx});
      };
      ${variables.exports};
   `
}

/**
 * 处理svg
 */
const webpackSvgr: NextConfig['webpack'] = (config, context) => {
  // Grab the existing rule that handles SVG imports
  const fileLoaderRule = config.module.rules.find((rule: any) =>
    rule.test?.test?.('.svg'),
  )

  config.module.rules.push(
    // 处理svg作为字符串导入
    {
      test: /\.svg$/i,
      resourceQuery: /raw/,
      type: 'asset/source',
      generator: {
        dataUrl: (content: string) => content,
      },
    },
    // Reapply the existing rule, but only for svg imports ending in ?url
    {
      ...fileLoaderRule,
      test: /\.svg$/i,
      resourceQuery: /url/, // *.svg?url
    },
    // Convert all other *.svg imports to React components
    {
      test: /\.svg$/i,
      issuer: fileLoaderRule.issuer,
      resourceQuery: {
        not: [...fileLoaderRule.resourceQuery.not, /url/, /raw/],
      }, // exclude if *.svg?url
      use: [
        {
          loader: '@svgr/webpack',
          options: {
            typescript: true,
            svgoConfig: {
              plugins: [
                {
                  name: 'preset-default',
                  params: {
                    overrides: {
                      // viewBox is required to resize SVGs with CSS.
                      // @see https://github.com/svg/svgo/issues/1128
                      removeViewBox: false,
                      cleanupIds: false,
                    },
                  },
                },
              ],
            },
            template: createSvgTemplate,
          },
        },
      ],
    },
  )

  // Modify the file loader rule to ignore *.svg, since we have it handled now.
  fileLoaderRule.exclude = /\.svg$/i
}

const nextConfig: NextConfig = {
  assetPrefix: baseURL,
  sassOptions: {},
  webpack: (config, context) => {
    webpackSvgr(config, context)
    return config
  },
}

export default nextConfig
