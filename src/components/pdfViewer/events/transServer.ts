import type { TranslateServiceInfo } from '../services/TranslationServiceManager'

export type TransServerEventsMap = {
  [TransServerEvents.UPDATE_EDITOR_ITEM_STATE]: {
    id: string
    text?: string
    model?: string
    syncStorage?: boolean
  }
  [TransServerEvents.TRIGGER_TRANSLATE_SERVICE]: TranslateServiceInfo
}

/**
 * 翻译服务事件
 */
export enum TransServerEvents {
  // 更新editorItem 状态
  UPDATE_EDITOR_ITEM_STATE = 'pdf:trans:updateEditorItemState',
  // 触发翻译服务
  TRIGGER_TRANSLATE_SERVICE = 'pdf:trans:triggerTranslateService',
}
