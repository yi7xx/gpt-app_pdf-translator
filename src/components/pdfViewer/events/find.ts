import type { PDFFindController } from '../modules/PDFFindController'

export interface FindTextPayload {
  query: string | string[]
  pageNumber: number
  // 是否并行处理，先精准后模糊
  parallel?: boolean
  // 是否开启模糊匹配
  fuzzyMatch?: boolean
  // 完整单词匹配
  entireWord?: boolean
  // 是否高亮所有匹配
  highlightAll?: boolean
  // 是否查找上一个匹配
  findPrevious?: boolean
  // 是否区分大小写
  caseSensitive?: boolean
  // 是否匹配变音符号
  matchDiacritics?: boolean
}

export enum FindState {
  // 找到
  FOUND = 0,
  // 未找到
  NOT_FOUND = 1,
  // 已包裹
  WRAPPED = 2,
  // 等待
  PENDING = 3,
}

export type FindEventMap = {
  [FindEvent.FindText]: FindTextPayload
  [FindEvent.CloseFind]: void
  [FindEvent.UpdateFindControlState]: {
    source: PDFFindController
    state: FindState
    previous: boolean
    entireWord: boolean | null
    matchesCount: { current: number; total: number }
    rawQuery: string | string[] | null
  }
  [FindEvent.UpdateFindMatchesCount]: {
    source: PDFFindController
    matchesCount: { current: number; total: number }
  }
  [FindEvent.UpdateTextLayerMatches]: {
    source: PDFFindController
    pageIndex: number
    previousPageIndex?: number
  }
}

/**
 * 查找事件
 */
export enum FindEvent {
  // 查找文本
  FindText = 'find:text',
  // 关闭查找
  CloseFind = 'find:close',
  // 更新查找控制器状态
  UpdateFindControlState = 'find:update-control-state',
  // 更新查找匹配数量
  UpdateFindMatchesCount = 'find:update-matches-count',
  // 更新文本层匹配
  UpdateTextLayerMatches = 'find:update-text-layer-matches',
}
