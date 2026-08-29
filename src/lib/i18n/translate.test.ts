import { describe, expect, it } from 'vitest'
import { aerobicActivityLabel } from './index'
import { pickPlural, pluralForm, t } from './translate'

describe('t', () => {
  it('returns English copy', () => {
    expect(t('nav.today', undefined, 'en')).toBe('Today')
    expect(t('nav.today', undefined, 'sr')).toBe('Danas')
  })

  it('labels invited accounts as athletes, not light', () => {
    expect(t('coach.athleteAccount', undefined, 'en')).toBe('Athlete')
    expect(t('coach.athleteAccount', undefined, 'sr')).toBe('Vežbač')
    expect(t('coach.inviteHint', undefined, 'en')).not.toMatch(/light/i)
    expect(t('coach.inviteHint', undefined, 'sr')).not.toMatch(/light/i)
  })

  it('translates routine and plan editor chrome', () => {
    expect(t('editor.newTitle', undefined, 'en')).toBe('New routine')
    expect(t('editor.newTitle', undefined, 'sr')).toBe('Nova rutina')
    expect(t('editor.editTitle', undefined, 'sr')).toBe('Izmeni rutinu')
    expect(t('editor.saveRoutine', undefined, 'sr')).toBe('Sačuvaj rutinu')
    expect(t('editor.newPlanTitle', undefined, 'sr')).toBe('Novi plan')
  })

  it('translates starter program names', () => {
    expect(t('starters.street.name', undefined, 'en')).toBe('Street 3-day')
    expect(t('starters.street.name', undefined, 'sr')).toBe('Street 3 dana')
    expect(t('starters.home2.name', undefined, 'en')).toBe('Home 2-day')
    expect(t('starters.home2.name', undefined, 'sr')).toBe('Kuća 2 dana')
    expect(t('starters.equipmentHomeBar', undefined, 'en')).toBe('Home · bar · TRX')
    expect(t('starters.add', undefined, 'en')).toBe('Add plan')
    expect(t('starters.view', undefined, 'en')).toBe('View plan')
    expect(t('starters.add', undefined, 'sr')).toBe('Dodaj plan')
    expect(t('starters.view', undefined, 'sr')).toBe('Pogledaj plan')
    expect(t('starters.viewNamed', { name: 'Foundations 3-day' }, 'en')).toBe(
      'View Foundations 3-day',
    )
    expect(t('starters.count', { count: 8 }, 'en')).toBe('8 programs')
    expect(t('starters.hide', undefined, 'sr')).toBe('Sakrij')
  })

  it('translates plan-delete routine prompt', () => {
    expect(t('editor.deletePlanYesRoutines', undefined, 'en')).toBe('Yes, remove the routines')
    expect(t('editor.deletePlanKeepRoutines', undefined, 'sr')).toBe('Zadrži rutine')
  })

  it('translates compact workout header stats', () => {
    expect(t('workout.elapsed', undefined, 'en')).toBe('Time')
    expect(t('workout.setsLabel', undefined, 'sr')).toBe('Serije')
  })

  it('translates rest chip label', () => {
    expect(t('workout.restLabel', undefined, 'en')).toBe('Rest')
    expect(t('workout.restLabel', undefined, 'sr')).toBe('Odmor')
  })

  it('translates collapse-to-reorder copy', () => {
    expect(t('workout.collapseToReorder', { name: 'Squat' }, 'en')).toBe(
      'Collapse Squat to reorder',
    )
    expect(t('workout.collapseToReorder', { name: 'Čučanj' }, 'sr')).toBe(
      'Skupi Čučanj da promeniš redosled',
    )
  })

  it('translates add-notes copy', () => {
    expect(t('editor.addNotes', undefined, 'en')).toBe('Add notes')
    expect(t('editor.addNotes', undefined, 'sr')).toBe('Dodaj beleške')
  })

  it('translates automatic YouTube form-video copy', () => {
    expect(t('exercises.videoHint', undefined, 'en')).toMatch(/proper form/)
    expect(t('exercises.videoHint', undefined, 'sr')).toMatch(/proper form/)
  })

  it('translates warm-up exercise and bodyweight load copy', () => {
    expect(t('editor.warmupExercise', undefined, 'en')).toBe('Warm-up exercise')
    expect(t('editor.warmupExercise', undefined, 'sr')).toBe('Vežba zagrevanja')
    expect(t('set.addWarmup', undefined, 'en')).toBe('Add warm-up')
    expect(t('set.bodyweight', undefined, 'sr')).toBe('BW')
  })

  it('translates progress chart empty copy', () => {
    expect(t('progress.chartEmpty', undefined, 'en')).toBe('No data yet.')
    expect(t('progress.chartEmpty', undefined, 'sr')).toBe('Još nema podataka.')
  })

  it('translates aerobic sports', () => {
    expect(t('aerobic.basketball', undefined, 'en')).toBe('Basketball')
    expect(t('aerobic.basketball', undefined, 'sr')).toBe('Košarka')
    expect(t('aerobic.tableTennis', undefined, 'en')).toBe('Table tennis')
    expect(t('aerobic.tableTennis', undefined, 'sr')).toBe('Stoni tenis')
    expect(t('aerobic.logged', undefined, 'sr')).toBe('Zabeležene aktivnosti')
    expect(t('calendar.aerobic', undefined, 'en')).toBe('Aerobic')
    expect(t('calendar.aerobic', undefined, 'sr')).toBe('Aerobno')
  })

  it('labels stored aerobic activity types', () => {
    expect(aerobicActivityLabel('basketball', 'sr')).toBe('Košarka')
    expect(aerobicActivityLabel('table_tennis', 'en')).toBe('Table tennis')
    expect(aerobicActivityLabel('football', 'sr')).toBe('Fudbal')
    expect(aerobicActivityLabel('unknown_sport')).toBe('unknown_sport')
  })

  it('interpolates placeholders', () => {
    expect(t('today.startWorkout', undefined, 'en')).toBe('Start workout')
    expect(t('workout.noAssigned', undefined, 'en')).toMatch(/coach/i)
    expect(t('workout.noAssigned', undefined, 'sr')).toMatch(/trener/i)
    expect(t('today.hi', { name: 'Ana' }, 'en')).toBe('Hi, Ana')
    expect(t('today.hi', { name: 'Ana' }, 'sr')).toBe('Zdravo, Ana')
  })

  it('falls back to English for unknown keys', () => {
    expect(t('nav.today', undefined, 'sr')).toBe('Danas')
  })
})

describe('pluralForm', () => {
  it('uses English one/other', () => {
    expect(pluralForm(1, 'en')).toBe('one')
    expect(pluralForm(0, 'en')).toBe('other')
    expect(pluralForm(2, 'en')).toBe('other')
  })

  it('uses Serbian one/few/other', () => {
    expect(pluralForm(1, 'sr')).toBe('one')
    expect(pluralForm(21, 'sr')).toBe('one')
    expect(pluralForm(2, 'sr')).toBe('few')
    expect(pluralForm(4, 'sr')).toBe('few')
    expect(pluralForm(22, 'sr')).toBe('few')
    expect(pluralForm(5, 'sr')).toBe('other')
    expect(pluralForm(11, 'sr')).toBe('other')
    expect(pluralForm(0, 'sr')).toBe('other')
  })
})

describe('pickPlural', () => {
  it('picks a form', () => {
    expect(pluralForm(1, 'en')).toBe('one')
    expect(pickPlural(2, 'one workout', 'workouts', 'treninga')).toBe('workouts')
  })
})
