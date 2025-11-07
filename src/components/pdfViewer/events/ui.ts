import type { HighlightItem } from '../components/HighlightList'
import type {
  AnnotationEditorUIManager,
  TextToHighlight,
} from '../modules/AnnotationEditorUIManager'
import type { Highlight } from '../modules/highlight'
import type { PDFPrintService } from '../modules/PDFPrintService'

export type UIEventsMap = {
  [UIEvents.ActionChanging]: {
    action: 'hide-bar' | 'thumbnail' | 'highlight'
  }
  [UIEvents.SelectionEnd]: {
    event: PointerEvent
  }
  [UIEvents.ToggleHighlight]: {
    source: Highlight
    event: MouseEvent
    selected: boolean
  }
  [UIEvents.Print]: void
  [UIEvents.DownloadUpdateTranslating]: {
    source: PDFPrintService
    current: number
    total: number
  }
  [UIEvents.DownloadTranslateDone]: {
    source: PDFPrintService
  }
  [UIEvents.DownloadTranslateError]: {
    source: PDFPrintService
    pageNumber: number
    mode: 'direct' | 'translate'
    reason: 'translate' | 'fetchData'
    showTooltip: boolean
  }
  [UIEvents.TextToHighlightSuccess]: {
    source: TextToHighlight
    highlight: Highlight
  }
  [UIEvents.AddHighlight]: {
    source: AnnotationEditorUIManager
    highlight: HighlightItem
  }
  [UIEvents.RemoveHighlight]: {
    source: AnnotationEditorUIManager
    highlight: HighlightItem
  }
}

/**
 * 侧边栏通用事件
 */
export enum UIEvents {
  // 侧变量切换事件
  ActionChanging = 'ui:actionChanging',
  // 选中结束事件
  SelectionEnd = 'ui:selectionEnd',
  // 点击高亮事件
  ToggleHighlight = 'ui:toggleHighlight',
  // 打印事件
  Print = 'ui:print',
  // 更新翻译进度
  DownloadUpdateTranslating = 'ui:downloadUpdateTranslating',
  // 下载翻译完成
  DownloadTranslateDone = 'ui:downloadTranslateDone',
  // 下载翻译失败
  DownloadTranslateError = 'ui:downloadTranslateError',
  // 初始化高亮数据
  InitHighlights = 'ui:initHighlights',
  // 新增高亮数据
  AddHighlight = 'ui:addHighlight',
  // text 转 highlight数据，转化成功
  TextToHighlightSuccess = 'ui:textToHighlightSuccess',
  // 移除高亮数据
  RemoveHighlight = 'ui:removeHighlight',
}
