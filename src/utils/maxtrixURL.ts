const MATRIX_BASE_URL = '/gpt-proxy'

interface PathSegment {
  path: string
  params: Record<string, string | number | boolean>
}

/**
 * 构建带有 Matrix Parameters 的 URL 路径
 * @param segments - 路径段数组，每个段包含路径和参数
 * @returns 构建后的矩阵URL
 * @example
 * buildMatrixURL([
 *   { path: 'user', params: { id: 1 } },
 *   { path: 'posts', params: { limit: 10 } },
 * ])
 * // => '/user;id=1/posts;limit=10'
 */
export const buildMatrixURL = (segments: PathSegment[]) => {
  if (!Array.isArray(segments) || segments.length === 0) {
    return '/'
  }

  const buildSegment = (segment: PathSegment): string => {
    const { path, params } = segment

    if (!params || Object.keys(params).length === 0) {
      return path
    }

    const paramString = Object.entries(params)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return value
            .map((v) => `;${key}=${encodeURIComponent(String(v))}`)
            .join('')
        }
        if (value === '' || value === true) {
          return `;${key}`
        }
        if (value === null || value === undefined) {
          return ''
        }
        return `;${key}=${encodeURIComponent(String(value))}`
      })
      .filter(Boolean)
      .join('')

    return path + paramString
  }

  return MATRIX_BASE_URL + '/' + segments.map(buildSegment).join('/')
}
