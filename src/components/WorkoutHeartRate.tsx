import { useEffect, useRef, useState } from 'react'
import { recordHeartRate } from '../lib/db'
import { flushNativeHeartRate } from '../lib/flushHeartRate'
import {
  connectHeartRateDevice,
  isNativeApp,
  nativeHeartRateState,
  scanHeartRateDevices,
  stopHeartRateDevice,
  type HeartRateDevice,
  type NativeHeartRateState,
} from '../lib/herkulesHealth'
import { useT } from '../lib/i18n'
import { Modal } from './ui'

interface WebHeartRateCharacteristic extends EventTarget {
  value?: DataView
  startNotifications(): Promise<unknown>
}

interface WebHeartRateDevice extends EventTarget {
  gatt?: {
    connect(): Promise<{
      getPrimaryService(service: string): Promise<{
        getCharacteristic(name: string): Promise<WebHeartRateCharacteristic>
      }>
    }>
    disconnect(): void
  }
}

interface HeartRateBluetooth {
  requestDevice(options: { filters: { services: string[] }[] }): Promise<WebHeartRateDevice>
}

type NativeStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'failed' | 'lost'

/**
 * The native service owns the sensor connection, so it outlives this component:
 * leaving the workout screen keeps recording. Finish and Discard stop it.
 */
function NativeWorkoutHeartRate({ sessionId }: { sessionId: string }) {
  const { t } = useT()
  const [status, setStatus] = useState<NativeStatus>('idle')
  const [devices, setDevices] = useState<HeartRateDevice[]>([])
  const [reading, setReading] = useState<number | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const [scanEmpty, setScanEmpty] = useState(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    // Pick up a connection made before the user left this screen.
    void nativeHeartRateState()
      .then((native) => {
        if (!alive.current) return
        if (native.state === 'connecting' || native.state === 'connected' || native.state === 'lost') {
          setStatus(native.state)
        }
      })
      .catch(() => {})
    return () => {
      alive.current = false
      // Write what arrived so far; the sensor keeps buffering natively.
      void flushNativeHeartRate(sessionId).catch(() => {})
    }
  }, [sessionId])

  const polling = status === 'connecting' || status === 'connected' || status === 'lost'
  useEffect(() => {
    if (!polling) return
    const timer = setInterval(() => {
      void flushNativeHeartRate(sessionId)
        .then(({ latest, state }: { latest: number | null; state: NativeHeartRateState }) => {
          if (!alive.current) return
          if (state === 'connected') {
            if (latest !== null) setReading(latest)
          } else {
            setReading(null)
          }
          setScanEmpty(false)
          setStatus(state)
          setSaveFailed(false)
        })
        .catch(() => {
          if (alive.current) setSaveFailed(true)
        })
    }, 2000)
    return () => clearInterval(timer)
  }, [sessionId, polling])

  async function scan() {
    setStatus('scanning')
    setDevices([])
    setSaveFailed(false)
    try {
      const found = await scanHeartRateDevices()
      if (!alive.current) return
      setDevices(found)
      setScanEmpty(found.length === 0)
      setStatus(found.length === 0 ? 'failed' : 'idle')
    } catch {
      if (!alive.current) return
      setScanEmpty(false)
      setStatus('failed')
    }
  }

  async function connect(device: HeartRateDevice) {
    setStatus('connecting')
    setDevices([])
    try {
      const native = await connectHeartRateDevice(device, t('heartRate.notification'))
      if (!alive.current) return
      setScanEmpty(false)
      setStatus(native.state)
    } catch {
      if (alive.current) setStatus('failed')
    }
  }

  async function disconnect() {
    await flushNativeHeartRate(sessionId).catch(() => null)
    await stopHeartRateDevice()
    setReading(null)
    setStatus('idle')
  }

  // A dropped sensor still offers Disconnect while the app waits for it.
  const connected = status === 'connected' || status === 'lost'
  const message =
    status === 'failed' && scanEmpty
      ? 'heartRate.noneFound'
      : status === 'failed'
        ? 'heartRate.failed'
        : status === 'lost'
          ? 'heartRate.lost'
          : saveFailed
            ? 'heartRate.saveFailed'
            : null

  return (
    <div className="workout-heart-rate">
      <div className="workout-heart-rate__bar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12h5l3-7 4 14 3-7h5" />
        </svg>
        <span className="workout-heart-rate__value">
          {reading !== null && connected ? t('heartRate.bpm', { bpm: reading }) : t(connected ? 'heartRate.waiting' : 'heartRate.label')}
        </span>
        <button
          type="button"
          className="btn workout-heart-rate__action"
          disabled={status === 'scanning' || status === 'connecting'}
          aria-label={t(connected ? 'heartRate.disconnect' : 'heartRate.connect')}
          onClick={() => void (connected ? disconnect() : scan())}
        >
          {t(
            connected
              ? 'heartRate.disconnectShort'
              : status === 'scanning' || status === 'connecting'
                ? 'heartRate.connecting'
                : 'heartRate.connectShort',
          )}
        </button>
      </div>
      {message ? <p className="workout-heart-rate__message" role="status">{t(message)}</p> : null}
      {devices.length > 0 && !connected ? (
        <Modal title={t('heartRate.pick')} onClose={() => setDevices([])}>
          <div className="stack">
            {devices.map((device) => (
              <button key={device.id} type="button" className="btn btn--block" onClick={() => void connect(device)}>
                {device.name || device.id}
              </button>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

export function WorkoutHeartRate({ sessionId }: { sessionId: string }) {
  if (isNativeApp()) return <NativeWorkoutHeartRate sessionId={sessionId} />
  return <WebWorkoutHeartRate sessionId={sessionId} />
}

function WebWorkoutHeartRate({ sessionId }: { sessionId: string }) {
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
    let device: WebHeartRateDevice | undefined
    let characteristic: WebHeartRateCharacteristic | undefined
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

  const connected = status === 'connected'
  const message = status === 'failed' ? 'heartRate.failed'
    : status === 'lost' ? 'heartRate.lost'
    : saveFailed ? 'heartRate.saveFailed' : null

  return (
    <div className="workout-heart-rate">
      <div className="workout-heart-rate__bar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12h5l3-7 4 14 3-7h5" />
        </svg>
        <span className="workout-heart-rate__value">
          {reading !== null && connected
            ? t('heartRate.bpm', { bpm: reading })
            : t(connected ? 'heartRate.waiting' : 'heartRate.label')}
        </span>
        <button type="button" className="btn workout-heart-rate__action"
          disabled={status === 'connecting'}
          aria-label={t(connected ? 'heartRate.disconnect' : 'heartRate.connect')}
          onClick={() => {
            if (connected) {
              cleanup.current?.()
              setStatus('idle')
            } else {
              void connect()
            }
          }}>
          {t(connected ? 'heartRate.disconnectShort' : status === 'connecting' ? 'heartRate.connecting' : 'heartRate.connectShort')}
        </button>
      </div>
      {message && <p className="workout-heart-rate__message" role="status">{t(message)}</p>}
    </div>
  )
}
