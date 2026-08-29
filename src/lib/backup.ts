// Full-account JSON backup: everything the user owns in one portable file.
// Restore is an idempotent upsert keyed by row ids — it never deletes rows
// that are absent from the file.
import type {
  BodyMeasureRow,
  BodyWeightRow,
  AerobicActivityRow,
  ExerciseRow,
  ProfileRow,
  RecurrenceRuleRow,
  ScheduleItemRow,
  SessionDoc,
  TemplateItemRow,
  TemplateBlockRow,
  TemplateRow,
  TendonCheckinRow,
  TrainingPlanRow,
  PlanRoutineRow,
} from '../types/db'
import { t } from './i18n'

export const BACKUP_FORMAT = 'herkules-backup'
export const BACKUP_VERSION = 5

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exported_at: string
  profile: ProfileRow | null
  bodyWeights: BodyWeightRow[]
  bodyMeasures: BodyMeasureRow[]
  /** user-owned exercises only — the system catalog is seeded server-side */
  exercises: ExerciseRow[]
  plans: TrainingPlanRow[]
  templates: TemplateRow[]
  planRoutines: PlanRoutineRow[]
  templateBlocks: TemplateBlockRow[]
  templateItems: TemplateItemRow[]
  rules: RecurrenceRuleRow[]
  schedules: ScheduleItemRow[]
  sessions: SessionDoc[]
  checkins: TendonCheckinRow[]
  aerobicActivities: AerobicActivityRow[]
}

type BackupInput = Omit<
  BackupFile,
  | 'format'
  | 'version'
  | 'exported_at'
  | 'templateBlocks'
  | 'aerobicActivities'
  | 'bodyMeasures'
  | 'planRoutines'
> & Partial<Pick<BackupFile, 'templateBlocks' | 'aerobicActivities' | 'bodyMeasures' | 'planRoutines'>>

export function serializeBackup(input: BackupInput): string {
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    ...input,
    templateBlocks: input.templateBlocks ?? [],
    aerobicActivities: input.aerobicActivities ?? [],
    bodyMeasures: input.bodyMeasures ?? [],
    planRoutines: input.planRoutines ?? [],
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
    throw new Error(t('errors.invalidJson'))
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(t('errors.notBackup'))
  }
  const file = parsed as Partial<BackupFile>
  if (file.format !== BACKUP_FORMAT) {
    throw new Error(t('errors.notBackup'))
  }
  if (typeof file.version !== 'number' || file.version > BACKUP_VERSION) {
    throw new Error(t('errors.backupNewer'))
  }
  for (const key of LIST_KEYS) {
    if (!Array.isArray(file[key])) {
      throw new Error(t('errors.backupMissing', { key }))
    }
  }
  const plans = Array.isArray(file.plans)
    ? file.plans
    : file.version < 2
      ? []
      : null
  if (plans === null) {
    throw new Error(t('errors.backupMissingPlans'))
  }
  const templateBlocks = Array.isArray(file.templateBlocks)
    ? file.templateBlocks
    : file.version < 3
      ? []
      : null
  const aerobicActivities = Array.isArray(file.aerobicActivities)
    ? file.aerobicActivities
    : file.version < 3
      ? []
      : null
  const bodyMeasures = Array.isArray(file.bodyMeasures)
    ? file.bodyMeasures
    : file.version < 4
      ? []
      : null
  if (templateBlocks === null || aerobicActivities === null) {
    throw new Error(t('errors.backupMissingHybrid'))
  }
  if (bodyMeasures === null) {
    throw new Error(t('errors.backupMissing', { key: 'bodyMeasures' }))
  }
  const templates = (file.templates as TemplateRow[]).map(normalizeTemplate)
  const planRoutines = Array.isArray(file.planRoutines)
    ? file.planRoutines
    : membershipsFromTemplates(templates)
  return {
    ...(file as BackupFile),
    plans,
    templateBlocks,
    aerobicActivities,
    bodyMeasures,
    templates,
    planRoutines,
  }
}

function membershipsFromTemplates(templates: TemplateRow[]): PlanRoutineRow[] {
  return templates
    .filter((row): row is TemplateRow & { plan_id: string } => Boolean(row.plan_id))
    .map((row) => ({
      id: row.id,
      owner_id: row.owner_id,
      plan_id: row.plan_id,
      template_id: row.id,
      position: row.plan_position,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))
}

function normalizeTemplate(row: TemplateRow): TemplateRow {
  return {
    ...row,
    plan_id: row.plan_id ?? null,
    plan_position: Number.isFinite(row.plan_position) ? row.plan_position : 0,
  }
}
