const MATRIX_BASE_URL = '/gpt-matrix'

interface GroupSegment {
  group: string
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
export const buildMatrixURL = (pathname: string, segments: GroupSegment[]) => {
  if (!Array.isArray(segments) || segments.length === 0) {
    return MATRIX_BASE_URL + pathname
  }

  const buildSegment = (segment: GroupSegment): string => {
    const { group, params } = segment

    if (!params || Object.keys(params).length === 0) {
      return group
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

    return group + paramString
  }

  return MATRIX_BASE_URL + pathname + '/' + segments.map(buildSegment).join('/')
}
