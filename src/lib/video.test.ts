import { describe, expect, it } from 'vitest'
import { formVideoUrl, youtubeProperFormUrl } from './video'

describe('youtubeProperFormUrl', () => {
  it('builds a YouTube search for the exercise name plus proper form', () => {
    expect(youtubeProperFormUrl('Pull-Up')).toBe(
      'https://www.youtube.com/results?search_query=Pull-Up%20proper%20form',
    )
    expect(youtubeProperFormUrl('  Goblet Squat ')).toBe(
      'https://www.youtube.com/results?search_query=Goblet%20Squat%20proper%20form',
    )
  })
})

describe('formVideoUrl', () => {
  it('returns null for an empty name', () => {
    expect(formVideoUrl(null)).toBeNull()
    expect(formVideoUrl('')).toBeNull()
    expect(formVideoUrl('   ')).toBeNull()
  })

  it('returns a search URL once a name exists', () => {
    expect(formVideoUrl('Dip')).toBe(youtubeProperFormUrl('Dip'))
  })
})
