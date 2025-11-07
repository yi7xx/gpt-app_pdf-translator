import { sleep } from '@sider/utils/index'
import { PDFViewerEvent, TransServerEvents, type PDFEventBus } from '../events'
import { LinkService } from '../modules/LinkService'
import { type Paragraph } from '../modules/PDFTransViewerUIManager'
import { SpreadMode } from '../modules/PDFViewer'
import {
  OCRService,
  TranslationService,
  TranslationStorageService,
  type PrintTranslateTask,
  type TranslateOption,
} from './TranslationService'

export interface TranslateResult<T> {
  isError: boolean
  stream?: boolean
  model?: string
  data: T | null
  message: string
  showTooltip?: boolean
  cancel?: boolean
}

export interface TranslateServiceInfo {
  compareEnabled: boolean
  fromLang: string
  toLang: string
  modelOption: TranslateOption
}

export interface TranslateServiceInfoDefault
  extends Partial<Omit<TranslateServiceInfo, 'modelOption'>> {
  modelName?: string
}

export interface TranslationServiceManagerOptions {
  translateServices: TranslationService[]
  translationStorageService?: TranslationStorageService
  ocrService?: OCRService
  eventBus: PDFEventBus
  globalEnableTranslate: boolean
  version: string
  spreadMode: SpreadMode
  defaultTranslateServerInfo?: TranslateServiceInfoDefault
}

export class TranslationServiceManager {
  private _version: string
  private services: Map<string, TranslationService>
  // @ts-ignore
  private _storageService: TranslationStorageService
  // @ts-ignore
  private _ocrService: OCRService
  private cancels: (() => void)[] = []
  private _linkService: LinkService | null
  private _enableTranslateService: boolean
  private _globalEnableTranslate: boolean
  private _translateInfo: TranslateServiceInfo
  private _defaultModelOption: TranslateOption
  private modelMap: Map<string, string>
  private modelOptionMap: Map<string, TranslateOption>
  private eventBus: PDFEventBus
  private streamMap: Map<Response, () => void>
  constructor(options: TranslationServiceManagerOptions) {
    const {
      version,
      translateServices,
      translationStorageService,
      globalEnableTranslate,
      defaultTranslateServerInfo,
      eventBus,
      ocrService,
      spreadMode,
    } = options
    this.services = new Map()
    this.cancels = []
    this._linkService = null
    this._globalEnableTranslate = globalEnableTranslate
    this._enableTranslateService = spreadMode !== SpreadMode.READ
    this.eventBus = eventBus
    this._version = version
    this.modelMap = new Map()
    this.modelOptionMap = new Map()
    this.streamMap = new Map()
    if (globalEnableTranslate) {
      if (!translationStorageService) {
        throw new Error('translationStorageService is required')
      }
      this._storageService = translationStorageService
      this._storageService.inject(this, this.eventBus)
    }
    if (globalEnableTranslate) {
      if (!ocrService) {
        throw new Error('ocrService is required')
      }
      this._ocrService = ocrService
      this._ocrService.inject(this, this.eventBus)
    }
    translateServices.forEach((service) => {
      this.services.set(service.name, service)
      service.inject(this, this.eventBus)
    })
    this._translateInfo = null as any
    this.initTranslateInfo(defaultTranslateServerInfo)
    this.normalizeModelOption()
    this._defaultModelOption = this._translateInfo.modelOption

    this.eventBus.on(PDFViewerEvent.PagesDestroy, () => {
      if (spreadMode === SpreadMode.READ) {
        this._enableTranslateService = false
        this.initTranslateInfo(defaultTranslateServerInfo)
      }
      this.cancelAll()
    })
  }

  get version() {
    return this._version
  }

  get options() {
    return Array.from(this.services.values()).reduce<TranslateOption[]>(
      (op, service) =>
        op.concat(
          service.options.map((option) => ({
            ...option,
            enableFullText: option.enableFullText ?? true,
            enableSingleLine: option.enableSingleLine ?? true,
          })),
        ),
      [],
    )
  }

  get storageService() {
    return this._storageService
  }

  get ocrService() {
    return this._ocrService
  }

  get translateInfo() {
    return this._translateInfo
  }

  set linkService(linkService: LinkService) {
    this._linkService = linkService
  }

  get globalEnableTranslate() {
    return this._globalEnableTranslate
  }

  get enableTranslateService() {
    return this._enableTranslateService
  }

  get defaultModelOption() {
    return this._defaultModelOption
  }

  // 判断是否为流式翻译
  get isStreamTranslate() {
    const service = this.getServiceByName(this._translateInfo.modelOption.name)
    return service?.stream ?? false
  }

  private initTranslateInfo(translateInfo?: TranslateServiceInfoDefault) {
    const {
      fromLang = 'auto',
      toLang = 'en',
      compareEnabled = true,
      modelName,
    } = translateInfo || {}
    const options = this.options
    const defaultOption = options.find((option) => option.name === modelName)
    this._translateInfo = {
      fromLang,
      toLang,
      compareEnabled,
      modelOption: defaultOption || options[0]!,
    }
  }

  updateModelOption(service: TranslationService) {
    service.options.forEach((option) => {
      this.modelMap.set(option.name, service.name)
      if (option.model) {
        this.modelMap.set(option.model, service.name)
      }
      this.modelOptionMap.set(option.name, option)
      if (option.model) {
        this.modelOptionMap.set(option.model, option)
      }
    })
  }

  private normalizeModelOption() {
    for (const [_, service] of this.services) {
      this.updateModelOption(service)
    }
  }

  private setupCancellation() {
    const controller = new AbortController()
    const cancel = () => {
      try {
        if (controller.signal.aborted) {
          return
        }
        controller.abort('AbortError')
      } catch (error) {
        console.log(error)
      }
    }
    this.pushCancel(cancel)

    return {
      signal: controller.signal,
      cancel,
      cleanup: () => this.removeCancel(cancel),
    }
  }

  private async executeTranslation<T>(
    type: string,
    params: any,
    operation: 'translate' | 'batchTranslate' | 'printTranslate',
  ): Promise<TranslateResult<T>> {
    const service = this.getServiceByName(type)
    let flagClean = false
    if (!service) {
      return {
        isError: true,
        data: null,
        model: type,
        message: 'Service not found',
      }
    }
    const { cancel, cleanup, signal } = this.setupCancellation()
    try {
      const promise = service[operation]({
        ...params,
        signal,
        cancel,
        options: params.options,
      })
      const result = await promise
      if (service.stream && !result.isError && !result.cancel) {
        this.streamMap.set(result.data as Response, cleanup)
      }
      flagClean = result.cancel || result.isError
      return {
        showTooltip: true,
        ...result,
        model: params.options.name,
        stream: service.stream,
      } as TranslateResult<T>
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          isError: false,
          data: null,
          model: type,
          cancel: true,
          showTooltip: true,
          message: 'AbortError',
        }
      }
      console.error(error)
      return {
        isError: true,
        data: null,
        showTooltip: true,
        model: type,
        message: error as string,
      }
    } finally {
      if (!service.stream || flagClean) {
        cleanup()
      }
    }
  }

  getServiceByName(serviceName: string) {
    return this.services.get(serviceName)
  }

  addService(service: TranslationService): void {
    if (!(service instanceof TranslationService)) {
      throw new Error('Service must be an instance of TranslationService')
    }

    if (this.services.has(service.name)) {
      throw new Error('Service already exists')
    }

    this.services.set(service.name, service)
  }

  normalizeParams<T>(params: {
    pageNumber: number
    text?: string
    texts?: T
    model?: string
  }) {
    const { model, ...rest } = params
    const {
      fromLang,
      toLang,
      modelOption: { name },
    } = this._translateInfo
    const modelOption = this.modelOptionMap.get(model || name)!
    const type = this.modelMap.get(model || name)!
    return {
      type,
      params: { ...rest, fromLang, toLang, options: modelOption },
    }
  }

  async parseStream(
    model: string,
    response: Response,
    callback: (texts: string[], done?: boolean) => void,
    errorCallback: (error: { message: string; showTooltip: boolean }) => void,
  ) {
    const type = this.modelMap.get(model)!
    const service = this.getServiceByName(type)
    if (!service) {
      errorCallback({
        message: 'Service not found',
        showTooltip: true,
      })
      return
    }
    await service.parseStream(response, callback, errorCallback)
    const cleanup = this.streamMap.get(response)
    if (cleanup) {
      cleanup()
      this.streamMap.delete(response)
    }
  }

  translate(pageNumber: number, text: string, model: string) {
    const { type, params } = this.normalizeParams({
      pageNumber,
      model,
      text,
    })
    return this.executeTranslation<string | Response | null>(
      type,
      params,
      'translate',
    )
  }

  batchTranslate(pageNumber: number, texts: string[], model?: string) {
    const { type, params } = this.normalizeParams({
      pageNumber,
      model,
      texts,
    })
    return this.executeTranslation<string[] | Response | null>(
      type,
      params,
      'batchTranslate',
    )
  }

  presetTaskResult<T>(pageNumber: number, data: T) {
    const { type } = this.normalizeParams({ pageNumber })
    const service = this.getServiceByName(type)
    if (!service) {
      return
    }
    service.presetTaskResult(pageNumber, data)
  }

  printTranslate(
    pageNumber: number,
    texts: string[],
    printTask: PrintTranslateTask,
    model?: string,
  ) {
    const { type, params } = this.normalizeParams({
      pageNumber,
      model,
      texts,
    })
    return this.executeTranslation<string[] | null>(
      type,
      { ...params, printTask },
      'printTranslate',
    )
  }

  ocr(
    file: Blob,
    options: {
      pageNumber: number
      scale: number
      width: number
      height: number
      paragraphs: Paragraph[]
    },
  ) {
    if (!this._ocrService) {
      throw new Error('ocrService is not initialized')
    }
    const { cancel, cleanup, signal } = this.setupCancellation()
    try {
      return this._ocrService.ocr({ ...options, file, cancel, signal })
    } finally {
      cleanup()
    }
  }

  // 校验是否为相同的翻译服务
  private shouldUpdateTranslateService(
    enable: boolean,
    params?: TranslateServiceInfo,
  ) {
    const shouldEnable = enable === this._enableTranslateService
    if (!enable && shouldEnable) {
      return true
    }
    const { fromLang, toLang, compareEnabled, modelOption } = params!
    return (
      shouldEnable &&
      this._translateInfo.fromLang === fromLang &&
      this._translateInfo.toLang === toLang &&
      this._translateInfo.compareEnabled === compareEnabled &&
      this._translateInfo.modelOption.name === modelOption.name
    )
  }

  // 是否强制翻译状态
  private isForceTranslating(params: TranslateServiceInfo) {
    const { fromLang, toLang, modelOption } = params
    return !(
      this._translateInfo.fromLang === fromLang &&
      this._translateInfo.toLang === toLang &&
      this._translateInfo.modelOption.name === modelOption.name
    )
  }

  // 开启并启用翻译服务
  async toggleTranslateService(enable: boolean, params?: TranslateServiceInfo) {
    if (!this._globalEnableTranslate) {
      return
    }
    if (this.shouldUpdateTranslateService(enable, params)) {
      return
    }
    if (!this._linkService) {
      console.error('linkService is not set, please set linkService first')
      return
    }
    const { pdfViewer } = this._linkService
    if (!pdfViewer) {
      console.error('pdfViewer is not set, please set pdfViewer first')
      return
    }
    const isForceTranslating = this.isForceTranslating(params!)
    this._enableTranslateService = enable
    this._translateInfo = params!
    if (!enable) {
      pdfViewer.spreadMode = SpreadMode.READ
      return
    }
    const compareEnabled = params!.compareEnabled
    await this.cancelAll()
    this.eventBus.emit(TransServerEvents.TRIGGER_TRANSLATE_SERVICE, params!)
    pdfViewer.resetSpreadMode(
      compareEnabled ? SpreadMode.COMPARE : SpreadMode.TRANSLATE,
      isForceTranslating,
    )
  }

  pushCancel(cancel: () => void) {
    this.cancels.push(cancel)
  }

  removeCancel(cancel: () => void) {
    this.cancels = this.cancels.filter((c) => c !== cancel)
  }

  async cancelAll() {
    this.cancels.forEach((c) => c())
    if (this.cancels.length) {
      await sleep(500)
    }
    this.cancels = []
  }

  destroy() {
    this.services.clear()
    this.cancelAll()
  }
}
