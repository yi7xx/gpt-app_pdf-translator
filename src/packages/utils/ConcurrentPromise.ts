interface TaskItem {
  id: string
  resolver: () => void
  rejecter: () => void
}
const CancelError = new Error('canceled task')

class ConcurrentPromise {
  private count: number
  private taskQueue: TaskItem[] = []
  private runningTasks: Set<string> = new Set()
  private taskIdCounter: number = 0
  private taskMap: Map<string, Promise<any>> = new Map()
  private isPaused: boolean = false

  constructor(maxConcurrency: number) {
    this.count = maxConcurrency
  }

  private generateTaskId() {
    return `task_${this.taskIdCounter++}`
  }

  private async acquire(taskId: string, appendToFront: boolean) {
    const { promise, resolve, reject } = Promise.withResolvers<string>()
    if (!this.isPaused && this.count > 0) {
      this.count--
      this.runningTasks.add(taskId)
      return taskId
    }
    const task = {
      id: taskId,
      resolver: () => {
        this.runningTasks.add(taskId)
        resolve(taskId)
      },
      rejecter: () => {
        reject(CancelError)
      },
    }
    if (appendToFront) {
      this.taskQueue.unshift(task)
    } else {
      this.taskQueue.push(task)
    }
    return promise
  }

  private async release(taskId: string) {
    if (!this.runningTasks.has(taskId)) {
      return
    }
    this.runningTasks.delete(taskId)
    this.taskMap.delete(taskId)
    if (!this.isPaused && this.taskQueue.length > 0) {
      const next = this.taskQueue.shift()!
      next.resolver()
    } else {
      this.count++
    }
  }

  private isCanceled(error: unknown) {
    return error === CancelError
  }

  // ================================ 暴露公共方法 ================================
  /**
   * 执行任务
   * 是否追加到最前面，调整任务执行的顺序
   */
  run<T>(
    fn: () => Promise<T>,
    opts: {
      appendToFront?: boolean
      // 指定任务id，如果指定，则不生成新的任务id
      taskId?: string
    } = {},
  ) {
    const { appendToFront = false } = opts
    const taskId = opts.taskId ?? this.generateTaskId()
    const { promise, resolve, reject } = Promise.withResolvers<T>()

    // 防止fn 同步错误导致promise 无法被catch
    promise.catch(() => {})

    this.taskMap.set(taskId, promise)

    this.acquire(taskId, appendToFront)
      .then(async () => {
        // 执行任务
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          // 不会触发cancel
          if (!this.isCanceled(error)) {
            reject(error)
          }
        } finally {
          this.release(taskId)
        }
      })
      .catch((error) => {
        reject(error)
      })
    return { taskId, promise }
  }

  /**
   * 批量执行任务
   */
  runBatch<T>(tasks: (() => Promise<T>)[]) {
    return tasks.map((task) => this.run(task))
  }

  /**
   * 移除单个任务
   */
  cancel(taskId: string) {
    if (this.runningTasks.has(taskId)) {
      return false
    }
    if (!this.taskMap.has(taskId)) {
      return false
    }
    const taskIndex = this.taskQueue.findIndex((task) => task.id === taskId)
    if (taskIndex !== -1) {
      const task = this.taskQueue[taskIndex]!
      this.taskQueue.splice(taskIndex, 1)
      task.rejecter()
    }
    return this.taskMap.delete(taskId)
  }

  /**
   * 获取指定 taskId Promise
   */
  getTaskPromise(taskId: string) {
    return this.taskMap.get(taskId)
  }

  /**
   * 判断当前任务是否正在运行中
   */
  isTaskRunning(taskId: string) {
    return this.runningTasks.has(taskId)
  }

  /**
   * 取消所有任务
   */
  cancelAll() {
    return this.taskQueue.map((task) => ({
      taskId: task.id,
      canceled: this.cancel(task.id),
    }))
  }

  /**
   * 清理
   */
  cleanup() {
    this.cancelAll()
    this.taskQueue = []
    this.runningTasks = new Set()
    this.taskMap = new Map()
    this.taskIdCounter = 0
    this.isPaused = false
  }

  /**
   * 停止任务处理
   * 已经在运行的任务会继续执行，但不会开始新的任务
   */
  pause() {
    this.isPaused = true
    return this.isPaused
  }

  /**
   * 恢复任务处理
   * 如果有等待中的任务且有可用槽位，立即开始处理
   */
  resume() {
    if (!this.isPaused) {
      return 0 // 已经在运行中，无需恢复
    }

    this.isPaused = false

    // 恢复后，尝试处理队列中的任务
    let processedCount = 0
    while (this.count > 0 && this.taskQueue.length > 0) {
      const next = this.taskQueue.shift()!
      next.resolver()
      this.count--
      processedCount++
    }

    return processedCount
  }

  /**
   * 获取当前暂停状态
   */
  isPauseActive() {
    return this.isPaused
  }

  /**
   * 获取当前队列中等待中的任务数量
   */
  getQueueLength() {
    return this.taskQueue.length
  }

  /**
   * 获取当前正在运行的任务数量
   */
  getRunningTasksCount() {
    return this.runningTasks.size
  }

  /**
   * 获取当前可用槽位数量
   */
  getAvailableSlots() {
    return this.count
  }
}

export default ConcurrentPromise
