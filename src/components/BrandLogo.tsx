// Rectangular Herkules wordmark — lion + barbell lockup for the top bar.
import type { Theme } from '../lib/theme'

export function BrandLogo({
  theme,
  size = 'bar',
}: {
  theme: Theme
  size?: 'bar' | 'sidebar' | 'auth'
}) {
  const src = `${import.meta.env.BASE_URL}logo-${theme === 'dark' ? 'dark' : 'light'}.png`
  return (
    <img
      src={src}
      alt="Herkules"
      className={`brand-logo brand-logo--${size}`}
      draggable={false}
    />
  )
}
