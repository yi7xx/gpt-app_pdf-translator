import type { Emitter } from 'mitt'
import mitt from 'mitt'

export type EmitParams<
  T extends keyof EventListener,
  EventListener,
> = EventListener[T] extends void ? [T] : [T, EventListener[T]]

export type HandlerEvent<T extends keyof EventListener, EventListener> = (
  payload: EventListener[T] & { event: T },
) => void

export class Mitter<EventListener extends Record<string, any>> {
  private mitter: Emitter<EventListener>
  private debug = false
  private _cancelMap = new Map<
    string,
    { handler: (...args: any[]) => void; rmAbort: () => void }[]
  >()

  constructor(debug = false) {
    this.mitter = mitt<EventListener>()
    this.debug = debug
  }

  /**
   * 订阅事件
   */
  on<T extends keyof EventListener>(
    event: T,
    handler: HandlerEvent<T, EventListener>,
    options?: { signal?: AbortSignal },
  ): void {
    this.mitter.on(event, handler as any)
    if (options?.signal instanceof AbortSignal) {
      this.addAbortHandler(event, handler, options.signal)
    }
  }

  /**
   * 发布事件
   */
  emit<T extends keyof EventListener>(
    ...params: EmitParams<T, EventListener>
  ): void {
    const [event, payload = {}] = params
    if (this.debug) {
      console.log('emit', event, payload)
    }
    this.mitter.emit(event, { event, ...payload } as any)
  }

  /**
   * 移除指定事件的订阅
   */
  off<T extends keyof EventListener>(
    event: T,
    handler: HandlerEvent<T, EventListener>,
  ): void {
    this.mitter.off(event, handler as any)
    this.removeAbortHandler(event, handler)
  }

  /**
   * 移除所有事件的订阅
   */
  removeAll(): void {
    this.mitter.all.clear()
    this._cancelMap.forEach((cancels) =>
      cancels.forEach((cancel) => cancel.rmAbort()),
    )
    this._cancelMap.clear()
  }

  private addAbortHandler<T extends keyof EventListener>(
    event: T,
    handler: HandlerEvent<T, EventListener>,
    signal: AbortSignal,
  ): void {
    const onAbort = () => this.off(event, handler)
    const rmAbort = () => signal.removeEventListener('abort', onAbort)

    signal.addEventListener('abort', onAbort)

    const cancels = this._cancelMap.get(event as string) || []
    cancels.push({ handler, rmAbort })
    this._cancelMap.set(event as string, cancels)
  }

  private removeAbortHandler<T extends keyof EventListener>(
    event: T,
    handler: HandlerEvent<T, EventListener>,
  ): void {
    const cancels = this._cancelMap.get(event as string)
    if (!cancels) return

    const index = cancels.findIndex((c) => c.handler === handler)
    if (index === -1) return

    cancels[index]?.rmAbort()
    cancels.splice(index, 1)

    if (cancels.length === 0) {
      this._cancelMap.delete(event as string)
    } else {
      this._cancelMap.set(event as string, cancels)
    }
  }
}
