/**
 * page 渲染状态
 */
export enum RenderingStates {
  // 初始化
  INITIAL = 0,
  // 渲染中
  RUNNING = 1,
  // 暂停
  PAUSED = 2,
  // 完成
  FINISHED = 3,
}

/**
 * 缩放模式
 */
export enum ScaleMode {
  // 实际大小
  PAGE_ACTUAL = 'page-actual',
  // 页面宽度
  PAGE_WIDTH = 'page-width',
  // 页面高度
  PAGE_HEIGHT = 'page-height',
  // 页面适应
  PAGE_FIT = 'page-fit',
  // 自动
  AUTO = 'auto',
}

// 默认缩放列表
const defaultZoomList = [0.75, 1, 1.2, 1.5, 2, 3]

export const ScaleModeOptions = [
  { label: '自动', value: ScaleMode.AUTO },
  { label: '实际大小', value: ScaleMode.PAGE_ACTUAL },
  { label: '页面宽度', value: ScaleMode.PAGE_WIDTH },
  { label: '页面高度', value: ScaleMode.PAGE_HEIGHT },
  { label: '页面适应', value: ScaleMode.PAGE_FIT },
  ...defaultZoomList.map((value) => ({
    label: `${value * 100}%`,
    value: `${value}`,
  })),
]

/**
 * 判断pdf page是否是竖屏
 */
export const isPortraitOrientation = (page: {
  width: number
  height: number
}) => {
  return page.height > page.width
}

/**
 * 将元素滚动到视图中
 * @param container - 滚动的父容器
 * @param element - 需要滚动到视图的元素
 * @param spot - 额外偏移量 { top?: number }
 */
export const scrollIntoView = (
  container: HTMLElement,
  element: HTMLElement,
  spot: {
    top?: number
    behavior?: ScrollBehavior
    isPageScroll?: boolean
  } = {},
): void => {
  if (!element || !container) {
    console.error('Invalid container or element')
    return
  }

  const { top = 0, behavior = 'instant', isPageScroll = false } = spot

  const nowOffsetTop = element.offsetTop
  const mintTop = container.scrollTop
  const maxTop = mintTop + container.clientHeight - element.clientHeight

  let offsetY = Number.MAX_SAFE_INTEGER

  if (isPageScroll) {
    offsetY = nowOffsetTop + top
  } else {
    if (nowOffsetTop < mintTop) {
      offsetY = nowOffsetTop
      if (top) {
        offsetY += top
      }
    } else if (nowOffsetTop > maxTop) {
      offsetY =
        element.offsetTop - container.clientHeight + element.clientHeight
      if (top) {
        offsetY -= top
      }
    }
  }

  if (offsetY === Number.MAX_SAFE_INTEGER) {
    return
  }
  container.scrollTo({
    top: offsetY,
    behavior,
  })
}

const InvisibleCharsRegExp = /[\x00-\x1F]/g

/**
 * 移除字符串中的不可见字符
 */
export const removeNullCharacters = (str: string, replaceInvisible = false) => {
  if (!InvisibleCharsRegExp.test(str)) {
    return str
  }
  if (replaceInvisible) {
    return str.replaceAll(InvisibleCharsRegExp, (m) =>
      m === '\x00' ? '' : ' ',
    )
  }
  return str.replaceAll('\x00', '')
}

/**
 * 绑定事件
 * @param obj - 绑定事件的对象
 * @param element - 绑定事件的元素
 * @param events - 绑定的事件
 */
export const bindEvents = (
  obj: any,
  element: HTMLElement,
  events: string[],
  options?: AddEventListenerOptions | boolean,
) => {
  events.forEach((event) => {
    element.addEventListener(event, obj[event].bind(obj), options)
  })
}
