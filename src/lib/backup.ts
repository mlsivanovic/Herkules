// Full-account JSON backup: everything the user owns in one portable file.
// Restore is an idempotent upsert keyed by row ids — it never deletes rows
// that are absent from the file.
import type {
  BodyWeightRow,
  ExerciseRow,
  ProfileRow,
  RecurrenceRuleRow,
  ScheduleItemRow,
  SessionDoc,
  TemplateItemRow,
  TemplateRow,
  TendonCheckinRow,
} from '../types/db'

export const BACKUP_FORMAT = 'herkules-backup'
export const BACKUP_VERSION = 1

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exported_at: string
  profile: ProfileRow | null
  bodyWeights: BodyWeightRow[]
  /** user-owned exercises only — the system catalog is seeded server-side */
  exercises: ExerciseRow[]
  templates: TemplateRow[]
  templateItems: TemplateItemRow[]
  rules: RecurrenceRuleRow[]
  schedules: ScheduleItemRow[]
  sessions: SessionDoc[]
  checkins: TendonCheckinRow[]
}

export function serializeBackup(
  input: Omit<BackupFile, 'format' | 'version' | 'exported_at'>,
): string {
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    ...input,
  }
  return JSON.stringify(file, null, 2)
}

const LIST_KEYS: (keyof BackupFile)[] = [
  'bodyWeights',
  'exercises',
  'templates',
  'templateItems',
  'rules',
  'schedules',
  'sessions',
  'checkins',
]

export function parseBackup(text: string): BackupFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('That file is not a Herkules backup.')
  }
  const file = parsed as Partial<BackupFile>
  if (file.format !== BACKUP_FORMAT) {
    throw new Error('That file is not a Herkules backup.')
  }
  if (typeof file.version !== 'number' || file.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of Herkules.')
  }
  for (const key of LIST_KEYS) {
    if (!Array.isArray(file[key])) {
      throw new Error(`The backup is missing the "${key}" list.`)
    }
  }
  return file as BackupFile
}
