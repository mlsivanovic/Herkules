import { useEffect, useRef, useState } from 'react'
import { recordHeartRate } from '../lib/db'
import { useT } from '../lib/i18n'

interface HeartRateCharacteristic extends EventTarget {
  value?: DataView
  startNotifications(): Promise<unknown>
}

interface HeartRateDevice extends EventTarget {
  gatt?: {
    connect(): Promise<{
      getPrimaryService(service: string): Promise<{
        getCharacteristic(name: string): Promise<HeartRateCharacteristic>
      }>
    }>
    disconnect(): void
  }
}

interface HeartRateBluetooth {
  requestDevice(options: { filters: { services: string[] }[] }): Promise<HeartRateDevice>
}

export function WorkoutHeartRate({ sessionId }: { sessionId: string }) {
  const { t } = useT()
  const bluetooth = (navigator as Navigator & { bluetooth?: HeartRateBluetooth }).bluetooth
  const cleanup = useRef<(() => void) | null>(null)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed' | 'lost'>('idle')
  const [reading, setReading] = useState<number | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => () => cleanup.current?.(), [])

  if (!bluetooth) return null
  const adapter = bluetooth

  async function connect() {
    setStatus('connecting')
    setReading(null)
    setSaveFailed(false)
    let device: HeartRateDevice | undefined
    let characteristic: HeartRateCharacteristic | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined

    function stop() {
      cleanup.current = null
      clearTimeout(timeout)
      characteristic?.removeEventListener('characteristicvaluechanged', onReading)
      device?.removeEventListener('gattserverdisconnected', onDisconnect)
      device?.gatt?.disconnect()
    }

    function onDisconnect() {
      stop()
      setStatus('lost')
    }

    function onReading() {
      const value = characteristic?.value
      if (!value || value.byteLength < 2) return
      const flags = value.getUint8(0)
      const wide = (flags & 1) !== 0
      if (wide && value.byteLength < 3) return
      if ((flags & 0x06) === 0x04) return
      const bpm = wide ? value.getUint16(1, true) : value.getUint8(1)
      setReading(bpm)
      clearTimeout(timeout)
      timeout = setTimeout(() => setReading(null), 5000)
      void recordHeartRate(sessionId, Date.now(), bpm).catch(() => {
        if (cleanup.current === stop) setSaveFailed(true)
      })
    }

    cleanup.current = stop
    try {
      device = await adapter.requestDevice({ filters: [{ services: ['heart_rate'] }] })
      if (cleanup.current !== stop) return
      if (!device.gatt) throw new Error('GATT unavailable')
      device.addEventListener('gattserverdisconnected', onDisconnect)
      const server = await device.gatt.connect()
      if (cleanup.current !== stop) {
        device.gatt.disconnect()
        return
      }
      const service = await server.getPrimaryService('heart_rate')
      characteristic = await service.getCharacteristic('heart_rate_measurement')
      if (cleanup.current !== stop) return
      characteristic.addEventListener('characteristicvaluechanged', onReading)
      await characteristic.startNotifications()
      if (cleanup.current === stop) setStatus('connected')
    } catch (error) {
      if (cleanup.current !== stop) return
      stop()
      setStatus(error instanceof DOMException && error.name === 'NotFoundError' ? 'idle' : 'failed')
    }
  }

  return (
    <div className="row workout-heart-rate">
      {status === 'connected' ? (
        <>
          <span>{reading === null ? t('heartRate.waiting') : t('heartRate.bpm', { bpm: reading })}</span>
          <button type="button" className="btn" onClick={() => {
            cleanup.current?.()
            setStatus('idle')
          }}>{t('heartRate.disconnect')}</button>
        </>
      ) : (
        <button type="button" className="btn" disabled={status === 'connecting'} onClick={() => void connect()}>
          {status === 'connecting' ? t('heartRate.connecting') : t('heartRate.connect')}
        </button>
      )}
      {status === 'failed' && <span role="status">{t('heartRate.failed')}</span>}
      {status === 'lost' && <span role="status">{t('heartRate.lost')}</span>}
      {saveFailed && <span role="status">{t('heartRate.saveFailed')}</span>}
    </div>
  )
}
