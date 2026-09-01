export type PrimarySection = 'today' | 'plan' | 'progress'

const PLAN_PREFIXES = ['/calendar', '/routines', '/plans', '/starters', '/exercises']
const PROGRESS_PREFIXES = ['/progress', '/history']

export function primarySectionForPath(pathname: string): PrimarySection | null {
  if (pathname === '/') return 'today'
  if (PLAN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return 'plan'
  }
  if (PROGRESS_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return 'progress'
  }
  return null
}
