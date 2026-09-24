// Рендерит PNG-иконки из SVG через Chromium (Playwright). Запуск: npm run icons
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const svg = (size, pad, bg, radius) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs><clipPath id="l"><circle cx="${38}" cy="50" r="${25 - pad}"/></clipPath></defs>
  <rect width="100" height="100" rx="${radius}" fill="${bg}"/>
  <circle cx="38" cy="50" r="${25 - pad}" fill="#3f8fef"/>
  <circle cx="62" cy="50" r="${25 - pad}" fill="#e5584d"/>
  <circle cx="62" cy="50" r="${25 - pad}" fill="#1b2740" clip-path="url(#l)"/>
</svg>`

const targets = [
  ['public/icons/apple-touch-icon.png', 180, 0, '#f1ece4', 0],
  ['public/icons/icon-192.png', 192, 0, '#f1ece4', 0],
  ['public/icons/icon-512.png', 512, 0, '#f1ece4', 0],
  ['public/icons/icon-maskable-512.png', 512, 5, '#f1ece4', 0],
  ['public/icons/badge-96.png', 96, 0, 'transparent', 0],
]

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage()
for (const [file, size, pad, bg, r] of targets) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size, pad, bg, r)}</body></html>`)
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
  writeFileSync(file, buf)
  console.log('wrote', file)
}
await browser.close()
