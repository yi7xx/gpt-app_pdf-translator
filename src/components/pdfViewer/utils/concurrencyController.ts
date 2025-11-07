interface QueueItem {
  priority: number;
  resolver: () => void;
}

interface QueueItem {
  priority: number;
  // 保持FIFO顺序
  sequence: number;
  resolver: () => void;
}

/**
 * 优化级大顶堆
 */
interface QueueItem {
  id: string | number;
  priority: number;
  sequence: number;
  resolver: () => void;
  rejecter: () => void;
}

class MaxHeap {
  private heap: QueueItem[];
  private sequenceCounter: number;
  private itemMap: Map<string | number, number>;

  constructor() {
    this.heap = [];
    this.sequenceCounter = 0;
    this.itemMap = new Map();
  }

  // 获取所有元素
  get items() {
    return this.heap;
  }

  private getParentIndex(index: number) {
    return Math.floor((index - 1) / 2);
  }

  private getLeftChildIndex(index: number) {
    return 2 * index + 1;
  }

  private getRightChildIndex(index: number) {
    return 2 * index + 2;
  }

  private swap(index1: number, index2: number) {
    const id1 = this.heap[index1]!.id;
    const id2 = this.heap[index2]!.id;
    this.itemMap.set(id1, index2);
    this.itemMap.set(id2, index1);

    const temp = this.heap[index1] as QueueItem;
    this.heap[index1] = this.heap[index2] as QueueItem;
    this.heap[index2] = temp;
  }

  private compare(a: QueueItem, b: QueueItem) {
    if (a.priority !== b.priority) {
      return a.priority > b.priority;
    }
    return a.sequence < b.sequence;
  }

  private siftUp(index: number) {
    while (index > 0) {
      const parentIndex = this.getParentIndex(index);
      if (
        this.compare(
          this.heap[parentIndex] as QueueItem,
          this.heap[index] as QueueItem
        )
      ) {
        break;
      }
      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private siftDown(index: number) {
    const size = this.heap.length;
    while (true) {
      let maxIndex = index;
      const leftIndex = this.getLeftChildIndex(index);
      const rightIndex = this.getRightChildIndex(index);

      if (
        leftIndex < size &&
        this.compare(
          this.heap[leftIndex] as QueueItem,
          this.heap[maxIndex] as QueueItem
        )
      ) {
        maxIndex = leftIndex;
      }

      if (
        rightIndex < size &&
        this.compare(
          this.heap[rightIndex] as QueueItem,
          this.heap[maxIndex] as QueueItem
        )
      ) {
        maxIndex = rightIndex;
      }

      if (maxIndex === index) {
        break;
      }

      this.swap(index, maxIndex);
      index = maxIndex;
    }
  }

  push(item: Omit<QueueItem, 'sequence'>) {
    const queueItem = {
      ...item,
      sequence: this.sequenceCounter++,
    };
    const index = this.heap.length;
    this.heap.push(queueItem);
    this.itemMap.set(queueItem.id, index);
    this.siftUp(index);
  }

  pop() {
    if (this.heap.length === 0) {
      return;
    }
    if (this.heap.length === 1) {
      const item = this.heap.pop()!;
      this.itemMap.delete(item.id);
      return item;
    }

    const result = this.heap[0];
    this.itemMap.delete(result!.id);

    const lastItem = this.heap.pop()!;
    this.heap[0] = lastItem;
    this.itemMap.set(lastItem.id, 0);
    this.siftDown(0);

    return result;
  }

  // 删除指定 id 的项
  remove(id: string | number) {
    const index = this.itemMap.get(id);
    if (index === undefined) return false;

    if (index === this.heap.length - 1) {
      this.heap.pop();
      this.itemMap.delete(id);
      return true;
    }

    this.swap(index, this.heap.length - 1);
    this.heap.pop();
    this.itemMap.delete(id);

    if (this.heap.length > 0) {
      this.siftUp(index);
      if (this.itemMap.get(this.heap[index]!.id) === index) {
        this.siftDown(index);
      }
    }

    return true;
  }

  // 调整优先级
  updatePriority(id: string | number, newPriority: number) {
    const index = this.itemMap.get(id);
    if (index === undefined) return false;

    const oldPriority = this.heap[index]!.priority;
    this.heap[index]!.priority = newPriority;

    // 根据新旧优先级的比较结果决定上浮还是下沉
    if (newPriority > oldPriority) {
      this.siftUp(index);
    } else if (newPriority < oldPriority) {
      this.siftDown(index);
    }

    return true;
  }

  // 查找指定 id 的项
  find(id: string | number) {
    const index = this.itemMap.get(id);
    return index !== undefined ? this.heap[index] : undefined;
  }

  get length() {
    return this.heap.length;
  }
}

export interface Task {
  id: string;
  priority: number;
  task?: () => Promise<any>;
  resolver: () => void;
}

export class ConcurrencyController {
  private count: number;
  private queue: MaxHeap;
  private runningTasks: Set<string>;
  private taskIdCounter: number;
  // 前缀
  private prefix: string;
  // 存储提前resolve的任务结果
  private presetTaskMap: Map<string, any>;
  public taskIdMap: Map<string, Promise<{ taskId: string; result: any }>>;

  constructor(maxConcurrency: number, prefix = 'task_') {
    this.count = maxConcurrency;
    this.queue = new MaxHeap();
    this.runningTasks = new Set();
    this.taskIdCounter = 0;
    this.taskIdMap = new Map();
    this.presetTaskMap = new Map();
    this.prefix = prefix;
  }

  // 是否存在task
  get hasTask() {
    return this.taskIdMap.size > 0;
  }

  isRunning(taskId: string) {
    return this.runningTasks.has(taskId);
  }

  generateTaskId(): string {
    return `${this.prefix}${this.taskIdCounter++}`;
  }

  async acquire(taskId: string, priority: number = 0) {
    const { promise, resolve, reject } = Promise.withResolvers<string>();
    if (this.count > 0) {
      this.count--;
      this.runningTasks.add(taskId);
      return taskId;
    }
    this.queue.push({
      id: taskId,
      priority,
      resolver: () => {
        this.runningTasks.add(taskId);
        resolve(taskId);
      },
      rejecter: () => {
        reject(new Error('Task cancelled'));
      },
    });
    return promise;
  }

  release(taskId: string) {
    if (!this.runningTasks.has(taskId)) {
      return;
    }
    this.runningTasks.delete(taskId);
    this.taskIdMap.delete(taskId);

    if (this.queue.length > 0) {
      const next = this.queue.pop()!;
      next.resolver();
    } else {
      this.count++;
    }
  }

  /**
   * 调整队列中等待任务的优先级
   * 如果任务已经在运行，直接返回，不调整优先级
   */
  updatePriority(taskId: string, newPriority: number): boolean {
    if (this.runningTasks.has(taskId)) {
      return false;
    }
    return this.queue.updatePriority(taskId, newPriority);
  }

  /**
   * 取消任务
   * 如果任务已经在运行，直接返回，不取消
   */
  cancel(taskId: string): boolean {
    if (this.runningTasks.has(taskId)) {
      return false;
    }
    const task = this.queue.find(taskId);
    if (task) {
      task.rejecter();
    }
    return this.queue.remove(taskId);
  }

  /**
   * 支持提前解决任务调度
   */
  presetTaskResult(taskId: string, data: any) {
    if (this.runningTasks.has(taskId)) {
      return false;
    }
    const task = this.queue.find(taskId);
    if (task) {
      this.presetTaskMap.set(taskId, data);
      this.queue.remove(taskId);
      task.resolver();
      return true;
    }
    return false;
  }

  /**
   * 取消所有任务
   */
  cancelAll() {
    for (const [taskId] of this.taskIdMap) {
      this.cancel(taskId);
    }
  }

  /**
   * 执行任务，返回任务ID和结果
   */
  run<T>(fn: () => Promise<T>, autoRelease = true, priority: number = 0) {
    const taskId = this.generateTaskId();
    const { promise, resolve, reject } = Promise.withResolvers<{
      taskId: string;
      result: T;
    }>();
    this.taskIdMap.set(taskId, promise);
    this.acquire(taskId, priority)
      .then(
        async () => {
          try {
            if (this.presetTaskMap.has(taskId)) {
              const result = this.presetTaskMap.get(taskId)!;
              resolve({ taskId, result });
              this.presetTaskMap.delete(taskId);
              return;
            }
            const result = await fn();
            resolve({ taskId, result });
          } catch (error) {
            // abort 请求
            console.warn(taskId, 'abort');
            reject(taskId);
          }
        },
        () => {
          console.warn(taskId, 'cancel');
          reject(taskId);
        }
      )
      .finally(() => {
        // 任务完成时，删除预设结果
        this.presetTaskMap.delete(taskId);
        if (autoRelease) {
          this.release(taskId);
        }
      });
    return { promise, taskId };
  }

  /**
   * 批量执行任务，返回任务ID和结果的映射
   */
  runBatch<T>(
    tasks: { task: () => Promise<T>; priority?: number }[],
    callback?: (evt: {
      taskId: string;
      result: T;
      completed: number;
      total: number;
      // 是否被取消请求
      isCancelled: boolean;
    }) => void,
    autoRelease = true
  ) {
    let completed = 0;
    const total = tasks.length;
    const results: {
      taskId: string;
      promise: Promise<{
        taskId: string;
        result: T;
      }>;
    }[] = [];

    const { promise, resolve } = Promise.withResolvers<
      {
        taskId: string;
        result: T;
      }[]
    >();

    for (const { task, priority } of tasks) {
      const { promise, taskId } = this.run(task, autoRelease, priority);
      results.push({ taskId, promise });
    }

    results.forEach(({ promise, taskId }) => {
      promise.then(
        ({ taskId, result }) => {
          completed++;
          callback?.({
            taskId,
            result,
            completed,
            total,
            isCancelled: false,
          });
        },
        () => {
          completed++;
          callback?.({
            taskId,
            result: null as any,
            completed,
            total,
            isCancelled: true,
          });
        }
      );
    });

    Promise.allSettled(results.map(({ promise }) => promise)).then(
      settledResults => {
        const results = settledResults.map(resole => {
          if (resole.status === 'fulfilled') {
            return resole.value;
          }
          return { taskId: resole.reason, result: null };
        });
        resolve(results as { taskId: string; result: T }[]);
      }
    );

    return { promise, results };
  }

  getTaskPriority(taskId: string) {
    const task = this.queue.find(taskId);
    return task?.priority;
  }

  get queueLength() {
    return this.queue.length;
  }

  get runningTasksCount() {
    return this.runningTasks.size;
  }
}
