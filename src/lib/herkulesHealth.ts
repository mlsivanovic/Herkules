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

interface HerkulesHealthPlugin {
  getStatus(): Promise<{ status: 'available' | 'update_required' | 'unavailable' }>
  requestHealthPermissions(): Promise<{ granted: boolean }>
  readWorkouts(options: { startMs: number; endMs: number }): Promise<{ workouts: RawHealthWorkout[] }>
  readHeartRate(options: { startMs: number; endMs: number }): Promise<{ samples: HeartRateSample[] }>
  scanHeartRate(): Promise<{ devices: HeartRateDevice[] }>
  connectHeartRate(options: { deviceId: string; notificationTitle: string }): Promise<void>
  drainHeartRate(): Promise<{ samples: HeartRateSample[] }>
  stopHeartRate(): Promise<void>
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

export async function connectHeartRateDevice(deviceId: string, notificationTitle: string): Promise<void> {
  await HerkulesHealth.connectHeartRate({ deviceId, notificationTitle })
}

export async function drainHeartRateSamples(): Promise<HeartRateSample[]> {
  if (!isNativeApp()) return []
  const result = await HerkulesHealth.drainHeartRate()
  return result.samples ?? []
}

export async function stopHeartRateDevice(): Promise<void> {
  if (!isNativeApp()) return
  await HerkulesHealth.stopHeartRate()
}
