// Generates public/ PNG icons from design/icon-source*.svg via sharp.
// Run once (and whenever the design changes): npm run icons
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')

async function render(source, size, target, { padding = 0 } = {}) {
  const svgBuffer = await sharp(path.join(root, 'design', source)).png().toBuffer()
  let pipeline = sharp(svgBuffer).resize(size, size)
  if (padding > 0) {
    pipeline = pipeline.extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 16, g: 26, b: 46, alpha: 1 },
    })
  }
  await pipeline.png().toFile(path.join(root, 'public', target))
  console.log(`✓ public/${target} (${size}x${size})`)
}

await mkdir(path.join(root, 'public'), { recursive: true })
await render('icon-source.svg', 192, 'icon-192.png')
await render('icon-source.svg', 512, 'icon-512.png')
// Maskable: artwork scaled into the safe zone on a full-bleed background
await render('icon-source-maskable.svg', 512, 'icon-512-maskable.png')
