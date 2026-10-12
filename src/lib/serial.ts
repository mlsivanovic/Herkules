/** Run async tasks one after another. A failure does not block the tasks behind it. */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve()

  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task)
    tail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
}
