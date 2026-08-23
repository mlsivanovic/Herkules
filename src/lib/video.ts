/** YouTube search used as the form-video link for every exercise. */
export function youtubeProperFormUrl(name: string): string {
  const query = `${name.trim()} proper form`
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

/** Null when the name is empty so the play button can stay hidden. */
export function formVideoUrl(name: string | null | undefined): string | null {
  const trimmed = name?.trim() ?? ''
  if (trimmed === '') return null
  return youtubeProperFormUrl(trimmed)
}
