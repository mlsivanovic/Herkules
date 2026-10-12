import { describe, expect, it } from 'vitest'
import { createSerialQueue } from './serial'

describe('createSerialQueue', () => {
  it('runs tasks in call order and keeps the last write', async () => {
    const enqueue = createSerialQueue()
    const log: string[] = []
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const first = enqueue(async () => {
      await gate
      log.push('first')
    })
    const second = enqueue(async () => {
      log.push('second')
      return 'final'
    })
    release()
    await first
    await expect(second).resolves.toBe('final')
    expect(log).toEqual(['first', 'second'])
  })

  it('continues after a rejected task', async () => {
    const enqueue = createSerialQueue()
    await expect(enqueue(async () => {
      throw new Error('nope')
    })).rejects.toThrow('nope')
    await expect(enqueue(async () => 'ok')).resolves.toBe('ok')
  })
})
