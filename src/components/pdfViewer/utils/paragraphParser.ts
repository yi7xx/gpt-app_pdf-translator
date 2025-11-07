/* eslint-disable max-lines */
import { type PDFPageProxy } from 'pdfjs-dist'
import type {
  TextContent,
  TextItem,
  TextMarkedContent,
} from 'pdfjs-dist/types/src/display/api'
import type { Paragraph } from '../modules/PDFTransViewerUIManager'

export interface TextItemWithMark extends TextItem {
  isMarked: boolean
}

export interface ProcessedTextItem extends TextItemWithMark {
  angle: number
  fontSize: number
  ascent: number
  descent: number
  mergeLine: number
  fontFamily: string
  isBold: boolean
  isItalic: boolean
  left: number
  top: number
  right: number
  bottom: number
}

type Transform = [number, number, number, number, number, number]

const MarkedOPS = [
  'beginMarkedContent',
  'beginMarkedContentProps',
  'endMarkedContent',
]

const LIST_MARKERS = ['•', '-', /^\d+(\.|\、|\．)/]

// 合并段落时的容差
const TOLERANCE = 1

/**
 * 提取页面文本，拆分为段落
 */
export const extractParagraphs = (
  page: PDFPageProxy,
  textContent: TextContent,
  keepEol: boolean = false,
) => {
  const viewport = page.getViewport({ scale: 1 })
  const { height: pageHeight, width: pageWidth, viewBox, rotation } = viewport
  const { pageHeight: rawPageHeight, pageX, pageY } = viewport.rawDims as any
  const _transform = [1, 0, 0, -1, -pageX, rawPageHeight + pageY] as Transform
  const { items, marksBox } = parseMarkedContent(textContent.items)
  const textItems = transformTextItem(items)
  const paragraphList = processTextContent()
  const paragraphs = transformToParagraph(paragraphList)

  /**
   * 处理markedContent数据
   */
  function parseMarkedContent(textItems: (TextItem | TextMarkedContent)[]) {
    const markedContentStack = []
    const marksBox: number[][] = []
    const items: TextItemWithMark[] = []
    for (const item of textItems) {
      if ('type' in item && MarkedOPS.includes(item.type)) {
        if (item.type === 'endMarkedContent') {
          markedContentStack.pop()
        } else {
          markedContentStack.push(item)
        }
        continue
      }
      const isMarkedContent = markedContentStack.length > 0

      items.push({
        ...(item as TextItem),
        isMarked: isMarkedContent,
      })
      // if (isMarkedContent) {
      //   marksBox.push(getTextItemBoundingBox(item as TextItem))
      // }
    }
    return { items, marksBox }
  }

  /**
   * 获取文本的
   */
  function getTextItemBoundingBox(textItem: TextItem) {
    const [a, b, c, d, e, f] = textItem.transform
    const { width, height } = textItem
    const localCorners = [
      [0, 0],
      [width, 0],
      [0, height],
      [width, height],
    ] as const
    const transformedCorners = localCorners.map(([x, y]) => {
      const xNew = a * x + b * y + e
      const yNew = c * x + d * y + f
      return [xNew, yNew]
    })
    let minX = Infinity,
      maxX = -Infinity
    let minY = Infinity,
      maxY = -Infinity
    for (const [x, y] of transformedCorners) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    const w = maxX - minX
    const h = maxY - minY
    return [minX, minY, w, h]
  }

  function transform(m1: Transform, m2: Transform): Transform {
    return [
      m1[0] * m2[0] + m1[2] * m2[1],
      m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3],
      m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
      m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
    ]
  }

  /**
   * 处理文本项的transform属性
   */
  function transformTextItem(textItems: TextItemWithMark[]) {
    return textItems.map((textItem) => {
      if (!textItem.transform) return textItem
      const transformMatrix = [...textItem.transform] as Transform
      if (rotation % 180 !== 0) {
        const tempX = transformMatrix[4]
        transformMatrix[4] = transformMatrix[5]
        transformMatrix[5] = pageHeight - tempX
      }
      transformMatrix[4] -= viewBox[0]!
      transformMatrix[5] -= viewBox[1]!
      return { ...textItem, transform: transformMatrix }
    })
  }

  /**
   * 获取字体对象
   */
  function getObjs(data: string) {
    return data.startsWith('g_') ? page.commonObjs : page.objs
  }

  /**
   * 获取字体信息
   */

  function getFont(data: string) {
    const { styles } = textContent
    const objs = getObjs(data)
    const font = objs.has(data) ? objs.get(data) : styles[data]
    const { fontFamily, name, fallbackName } = font
    return {
      ...font,
      fontFamily: fontFamily || fallbackName,
      isBold: name?.includes('Bold') || false,
      isItalic: name?.includes('Italic') || false,
    }
  }

  function getAngle(t: Transform, style: Record<string, any>) {
    const tx = transform(_transform, t)
    let angle = Math.atan2(tx[1], tx[0])
    if (style.vertical) {
      angle += Math.PI / 2
    }
    if (angle !== 0) {
      angle *= 180 / Math.PI
    }
    return angle
  }

  /**
   * 处理文本内容并进行合并
   */
  function processTextContent() {
    const paragraphList: ProcessedTextItem[] = []

    const addTextItemToParagraph = (textItem: ProcessedTextItem): void => {
      const {
        str,
        right,
        fontFamily,
        fontSize,
        bottom,
        top,
        hasEOL,
        transform,
      } = textItem

      // 字体为0，则跳过
      if (transform[0] === 0 || transform[3] === 0) {
        return
      }

      if (keepEol && hasEOL) {
        paragraphList.push(textItem)
        return
      }

      const currentParagraph = paragraphList.at(-1)

      if (!str.trim() || fontSize === 0) {
        if (hasEOL && currentParagraph) {
          currentParagraph.hasEOL = true
        }
        return
      }

      if (currentParagraph) {
        if (isConsecutiveText(currentParagraph, textItem)) {
          if (isAdjacentText(currentParagraph, textItem)) {
            currentParagraph.str += str
          } else {
            currentParagraph.str += ` ${str}`
          }
          currentParagraph.fontFamily = fontFamily
          currentParagraph.fontSize = Math.max(
            currentParagraph.fontSize,
            fontSize,
          )
          currentParagraph.right = right
          currentParagraph.top = Math.min(currentParagraph.top, top)
          currentParagraph.bottom = Math.max(currentParagraph.bottom, bottom)
          currentParagraph.hasEOL = currentParagraph.hasEOL || hasEOL
          return
        }
      }
      paragraphList.push(textItem)
    }

    const processedItems: ProcessedTextItem[] = textItems.map((textItem) => {
      const { transform, width, height, fontName, str } = textItem
      const font = getFont(fontName)
      const angle = getAngle(transform as Transform, font)
      const top = pageHeight - transform[5]
      const fontSize = transform[3] || Math.abs(transform[1])
      const ascent = font.ascent || 0.9
      const descent = font.descent || -0.2
      const adjustedTop = top - fontSize * ascent
      const adjustedBottom = top + fontSize * Math.abs(descent)

      const left =
        (angle + 360) % 180
          ? transform[4] - Math.abs(adjustedTop - adjustedBottom)
          : transform[4]
      const right = left + width

      return {
        ...textItem,
        ...font,
        ascent,
        descent,
        angle,
        // TODO:去掉特殊字符，主要是乱码
        str: str.replace(/||/gu, ''),
        fontSize,
        mergeLine: 0,
        left,
        top: adjustedTop,
        right,
        bottom: adjustedBottom,
      }
    })
    processedItems.forEach(addTextItemToParagraph)

    return mergeParagraphGroups(paragraphList)
  }

  function rotator(x: number, y: number, w: number, h: number) {
    return [
      x / pageWidth,
      y / pageHeight,
      w / pageWidth,
      h / pageHeight,
    ] as const
  }

  function transformToParagraph(paragraphList: ProcessedTextItem[]) {
    return paragraphList.map((item) => {
      const box = rotator(
        item.left,
        item.top,
        item.right - item.left,
        item.bottom - item.top,
      )
      return {
        sourceText: item.str,
        text: null,
        fontSize: Math.floor(item.fontSize * 100) / 100,
        fontFamily: item.fontFamily,
        isBold: item.isBold,
        isItalic: item.isItalic,
        mergeLine: item.mergeLine,
        angle: item.angle,
        isMarked: item.isMarked,
        std: true,
        box,
        layoutBox: [...box],
      } as Paragraph
    })
  }
  return {
    paragraphs,
    marksBox,
  }
}

export const mergeOCRParagraphs = (
  paragraphs: Paragraph[],
  pageWidth: number,
  pageHeight: number,
) => {
  const mergedList = paragraphs.map<ProcessedTextItem>((p) => {
    const {
      box,
      fontSize,
      fontFamily = '',
      isBold = false,
      isItalic = false,
      sourceText,
    } = p
    const [x, y, w, h] = box
    return {
      angle: 0,
      fontSize: fontSize,
      ascent: 0.85,
      descent: -0.15,
      mergeLine: 0,
      fontFamily: fontFamily,
      isBold: isBold,
      isItalic: isItalic,
      left: x * pageWidth,
      top: y * pageHeight,
      right: (x + w) * pageWidth,
      bottom: (y + h) * pageHeight,
      isMarked: true,
      str: sourceText,
      dir: '',
      transform: [],
      width: w * pageWidth,
      height: h * pageHeight,
      fontName: '',
      hasEOL: false,
    }
  })
  const newParagraphs = mergeParagraphGroups(mergedList)

  function rotator(x: number, y: number, w: number, h: number) {
    return [
      x / pageWidth,
      y / pageHeight,
      w / pageWidth,
      h / pageHeight,
    ] as const
  }

  function transformToParagraph(paragraphList: ProcessedTextItem[]) {
    return paragraphList.map((item) => {
      const box = rotator(
        item.left,
        item.top,
        item.right - item.left,
        item.bottom - item.top,
      )
      return {
        sourceText: item.str,
        text: null,
        fontSize: Math.floor(item.fontSize * 100) / 100,
        fontFamily: item.fontFamily,
        isBold: item.isBold,
        isItalic: item.isItalic,
        mergeLine: item.mergeLine,
        angle: item.angle,
        isMarked: item.isMarked,
        std: true,
        box,
        layoutBox: [...box],
      } as Paragraph
    })
  }
  return transformToParagraph(newParagraphs)
}

// 跳过翻译的文本
export const shouldSkipTranslation = (text: string): boolean => {
  return text.length <= 1 || /^[\d.:(),%\s-]*$/.test(text)
}

const isOverlappingVertically = (
  prev: ProcessedTextItem,
  next: ProcessedTextItem,
): boolean => {
  return prev.bottom > next.top && prev.top < next.bottom
}

const isWithinTolerance = (
  first: number,
  second: number,
  tolerance = 5,
  multiplier = 0.5,
): boolean => {
  return Math.abs(first - second) <= tolerance * multiplier
}

const isAdjacentText = (
  prev: ProcessedTextItem,
  next: ProcessedTextItem,
): boolean => {
  return isWithinTolerance(
    prev.right,
    next.left,
    next.left < prev.right ? prev.fontSize : 1,
    1,
  )
}

const isConsecutiveText = (
  prev: ProcessedTextItem,
  next: ProcessedTextItem,
): boolean => {
  if (!isOverlappingVertically(prev, next)) {
    return false
  }
  return isWithinTolerance(prev.right, next.left, next.fontSize, 1)
}

// TODO：需要处理垂直方向上的合并
const mergeParagraphGroups = (
  paragraphs: ProcessedTextItem[],
): ProcessedTextItem[] => {
  const mergedList: ProcessedTextItem[] = []

  paragraphs.forEach((currentParagraph: ProcessedTextItem, index: number) => {
    if (index === 0 || mergedList.length === 0) {
      addToMergedList(currentParagraph, mergedList)
      return
    }
    const lastMerged = mergedList.at(-1)!
    if (hasOverlap(lastMerged, currentParagraph)) {
      combineParagraphs(
        lastMerged,
        currentParagraph,
        !isWithinTolerance(lastMerged.bottom, currentParagraph.bottom),
      )
      return
    }
    if (!isWrappedLine(lastMerged, currentParagraph)) {
      addToMergedList(currentParagraph, mergedList)
      return
    }
    if (
      hasJustifiedAlignment(lastMerged, currentParagraph) ||
      hasLeftAlignment(lastMerged, currentParagraph) ||
      hasIndentation(lastMerged, currentParagraph) ||
      hasCenterAlignment(lastMerged, currentParagraph)
    ) {
      combineParagraphs(lastMerged, currentParagraph, true)
      return
    }

    if (
      startsWithAny(lastMerged.str, LIST_MARKERS) &&
      hasIndentation(currentParagraph, lastMerged)
    ) {
      combineParagraphs(lastMerged, currentParagraph, true)
      return
    }
    addToMergedList(currentParagraph, mergedList)
  })

  function isUnderlineText(text: string) {
    return !text || /^_{6,}$/.test(text)
  }

  function combineParagraphs(
    prev: ProcessedTextItem,
    next: ProcessedTextItem,
    isMergeLine = false,
    separator = '',
  ) {
    if (isUnderlineText(next.str)) {
      return
    }
    if (isMergeLine) {
      prev.mergeLine += 1
    }
    prev.str += separator + next.str
    prev.fontSize = Math.max(prev.fontSize, next.fontSize)
    prev.bottom = Math.max(prev.bottom, next.bottom)
    prev.left = Math.min(prev.left, next.left)
    prev.right = Math.max(prev.right, next.right)
    const lastItem = mergedList.at(-2)
    if (lastItem && hasOverlap(lastItem, prev)) {
      if (hasSimilarFont(lastItem, prev, true)) {
        const current = mergedList.pop()!
        if (lastItem.mergeLine === 0) {
          lastItem.mergeLine = current.mergeLine
        } else {
          const curLineHight =
            (current.bottom - current.top) / (current.mergeLine + 1)
          const diffTop = current.top - lastItem.top
          lastItem.mergeLine += Math.floor(diffTop / curLineHight)
        }
        combineParagraphs(lastItem, prev)
      } else {
        lastItem.bottom = prev.top - 0.1
      }
    }
  }

  function addToMergedList(
    paragraph: ProcessedTextItem,
    resultList: ProcessedTextItem[],
  ) {
    if (!isUnderlineText(paragraph.str)) {
      resultList.push(paragraph)
    }
  }

  function startsWithAny(text: string, prefixes: (string | RegExp)[]) {
    return prefixes.some((prefix: string | RegExp) => {
      if (typeof prefix === 'string') {
        return text.startsWith(prefix)
      }
      return prefix.test(text)
    })
  }

  function hasSimilarFont(
    prev: ProcessedTextItem,
    next: ProcessedTextItem,
    strictMatch = false,
  ) {
    const isTolerance = isWithinTolerance(prev.fontSize, next.fontSize, 2)
    const isFontFamily = prev.fontFamily === next.fontFamily
    const isFontBold = prev.isBold === next.isBold
    const isFontItalic = prev.isItalic === next.isItalic
    return strictMatch
      ? isTolerance && isFontFamily && isFontBold && isFontItalic
      : isTolerance
  }

  function isWrappedLine(prev: ProcessedTextItem, next: ProcessedTextItem) {
    const height = prev.fontSize * (prev.ascent + Math.abs(prev.descent))
    return (
      hasSimilarFont(prev, next) &&
      isWithinTolerance(prev.bottom, next.top, height, 1) &&
      !startsWithAny(next.str, LIST_MARKERS)
    )
  }

  function hasHorizontalOverlap(
    prev: ProcessedTextItem,
    next: ProcessedTextItem,
  ) {
    return !(prev.right < next.left || prev.left > next.right)
  }

  function hasVerticalOverlap(
    prev: ProcessedTextItem,
    next: ProcessedTextItem,
  ) {
    return !(prev.bottom < next.top || prev.top > next.bottom)
  }

  function hasOverlap(prev: ProcessedTextItem, next: ProcessedTextItem) {
    return hasHorizontalOverlap(prev, next) && hasVerticalOverlap(prev, next)
  }

  function hasJustifiedAlignment(
    prev: ProcessedTextItem,
    next: ProcessedTextItem,
  ) {
    const leftAligned = isWithinTolerance(prev.left, next.left, TOLERANCE)
    const rightAligned = isWithinTolerance(prev.right, next.right, TOLERANCE)
    return leftAligned && rightAligned
  }

  function hasLeftAlignment(prev: ProcessedTextItem, next: ProcessedTextItem) {
    return isWithinTolerance(prev.left, next.left, TOLERANCE)
  }

  function hasIndentation(prev: ProcessedTextItem, next: ProcessedTextItem) {
    const indentDiff = prev.left - next.left
    const isPositiveIndent = indentDiff > TOLERANCE * 0.5
    if (!isPositiveIndent) {
      return false
    }
    return isWithinTolerance(prev.left, next.left, 4 * next.fontSize, 1)
  }

  function hasCenterAlignment(
    prev: ProcessedTextItem,
    next: ProcessedTextItem,
  ) {
    const prevCenter = (prev.right - prev.left) / 2
    const nextCenter = (next.right - next.left) / 2
    return isWithinTolerance(prevCenter, nextCenter, TOLERANCE)
  }

  return mergedList
}
