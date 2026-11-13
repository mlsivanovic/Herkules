import { Capacitor, registerPlugin } from '@capacitor/core'
import type { HeartRateSample } from './heartRate'

export interface RawHealthWorkout {
  id: string
  origin: string
  exerciseType: number
  startMs: number
  endMs: number
  distanceM: number | null
  caloriesKcal: number | null
  heartRate: HeartRateSample[]
}

export interface HeartRateDevice {
  id: string
  name: string
}

/** `lost`: the sensor dropped mid-workout and the app is waiting for it to return. */
export type NativeHeartRateState = 'idle' | 'connecting' | 'connected' | 'lost' | 'failed'

export interface NativeHeartRateStatus {
  state: NativeHeartRateState
  deviceId?: string
  deviceName?: string
}

interface HerkulesHealthPlugin {
  getStatus(): Promise<{ status: 'available' | 'update_required' | 'unavailable' }>
  requestHealthPermissions(): Promise<{ granted: boolean }>
  readWorkouts(options: { startMs: number; endMs: number }): Promise<{ workouts: RawHealthWorkout[] }>
  readHeartRate(options: { startMs: number; endMs: number }): Promise<{ samples: HeartRateSample[] }>
  scanHeartRate(): Promise<{ devices: HeartRateDevice[] }>
  connectHeartRate(options: {
    deviceId: string
    deviceName: string
    notificationTitle: string
  }): Promise<NativeHeartRateStatus>
  heartRateState(): Promise<NativeHeartRateStatus>
  drainHeartRate(): Promise<NativeHeartRateStatus & { samples: HeartRateSample[] }>
  stopHeartRate(): Promise<NativeHeartRateStatus>
}

const HerkulesHealth = registerPlugin<HerkulesHealthPlugin>('HerkulesHealth')

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

export async function healthConnectStatus(): Promise<'available' | 'update_required' | 'unavailable'> {
  if (!isNativeApp()) return 'unavailable'
  const result = await HerkulesHealth.getStatus()
  return result.status
}

export async function requestHealthPermissions(): Promise<boolean> {
  if (!isNativeApp()) return false
  const result = await HerkulesHealth.requestHealthPermissions()
  return result.granted
}

export async function readHealthWorkouts(startMs: number, endMs: number): Promise<RawHealthWorkout[]> {
  if (!isNativeApp()) return []
  const result = await HerkulesHealth.readWorkouts({ startMs, endMs })
  return result.workouts ?? []
}

export async function readHealthHeartRate(startMs: number, endMs: number): Promise<HeartRateSample[]> {
  if (!isNativeApp()) return []
  const result = await HerkulesHealth.readHeartRate({ startMs, endMs })
  return result.samples ?? []
}

export async function scanHeartRateDevices(): Promise<HeartRateDevice[]> {
  if (!isNativeApp()) return []
  const result = await HerkulesHealth.scanHeartRate()
  return result.devices ?? []
}

export async function connectHeartRateDevice(
  device: HeartRateDevice,
  notificationTitle: string,
): Promise<NativeHeartRateStatus> {
  return HerkulesHealth.connectHeartRate({
    deviceId: device.id,
    deviceName: device.name,
    notificationTitle,
  })
}

export async function nativeHeartRateState(): Promise<NativeHeartRateStatus> {
  if (!isNativeApp()) return { state: 'idle' }
  return HerkulesHealth.heartRateState()
}

export async function drainHeartRateSamples(): Promise<{
  samples: HeartRateSample[]
  state: NativeHeartRateState
}> {
  if (!isNativeApp()) return { samples: [], state: 'idle' }
  const result = await HerkulesHealth.drainHeartRate()
  return { samples: result.samples ?? [], state: result.state ?? 'idle' }
}

export async function stopHeartRateDevice(): Promise<void> {
  if (!isNativeApp()) return
  await HerkulesHealth.stopHeartRate()
}
