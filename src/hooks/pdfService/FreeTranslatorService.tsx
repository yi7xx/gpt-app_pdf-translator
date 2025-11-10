import {
  TranslateType,
  TranslationService,
  TranslationServiceManager,
  type BatchTranslateParams,
  type PrintTranslateParams,
  type TranslateOption,
  type TranslateParams,
  type TranslateResult,
} from '@/components/pdfViewer'
import TranslatorCore from '@/packages/utils/TranslatorCore'
import { CreditBasicCircleFilled } from '@sider/icons'
// import { t } from '@wisebase/i18n/client'

export class FreeTranslatorService extends TranslationService {
  private serverManager: TranslationServiceManager | null = null
  private freeCore: TranslatorCore

  constructor() {
    super('free', false)
    this.serverManager = null
    this.freeCore = new TranslatorCore()
  }

  get options(): TranslateOption[] {
    return [
      {
        type: TranslateType.FREE,
        name: 'free',
        displayName: 'free',
        icon: <CreditBasicCircleFilled />,
      },
    ]
  }

  inject(manager: TranslationServiceManager) {
    this.serverManager = manager
  }

  async translate(params: TranslateParams): Promise<TranslateResult<string>> {
    const { fromLang, toLang, text } = params
    const result = await this.freeCore.translate(fromLang, toLang, [text])
    if (result.isError || !result.data) {
      return { isError: true, data: null, message: result.message }
    }
    return { isError: false, data: result.data[0]!, message: '' }
  }

  async batchTranslate(params: BatchTranslateParams) {
    const { texts, fromLang, toLang } = params
    return this.freeCore.translate(fromLang, toLang, texts)
  }

  async printTranslate(params: PrintTranslateParams) {
    return this.batchTranslate(params)
  }
}
