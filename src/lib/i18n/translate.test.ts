import { describe, expect, it } from 'vitest'
import { pickPlural, pluralForm, t } from './translate'

describe('t', () => {
  it('returns English copy', () => {
    expect(t('nav.today', undefined, 'en')).toBe('Today')
    expect(t('nav.today', undefined, 'sr')).toBe('Danas')
  })

  it('translates routine and plan editor chrome', () => {
    expect(t('editor.newTitle', undefined, 'en')).toBe('New routine')
    expect(t('editor.newTitle', undefined, 'sr')).toBe('Nova rutina')
    expect(t('editor.editTitle', undefined, 'sr')).toBe('Izmeni rutinu')
    expect(t('editor.saveRoutine', undefined, 'sr')).toBe('Sačuvaj rutinu')
    expect(t('editor.newPlanTitle', undefined, 'sr')).toBe('Novi plan')
  })

  it('interpolates placeholders', () => {
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
