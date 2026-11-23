// Captures d'écran du site en ligne (contrôle visuel après une mise à jour). Lancée à la main
// par le workflow « Capture du site » ; les images vont sur la branche probe-output.
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const url = process.env.SITE_URL || 'https://astiricx.github.io/radar-velo/'
mkdirSync('probe', { recursive: true })
const browser = await chromium.launch()
const report = []

async function shoot(name, viewport, steps) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  if (steps) await steps(page)
  await page.screenshot({ path: `probe/${name}.png`, fullPage: false })
  report.push(`${name}: ${(await page.locator('header p').first().textContent())?.trim()}`)
  report.push(`  ${(await page.locator('main section').first().innerText()).replace(/\s+/g, ' ').slice(0, 300)}`)
  await page.close()
}

await shoot('desktop-tous', { width: 1440, height: 1000 })
await shoot('desktop-neuf', { width: 1440, height: 1000 }, async (page) => {
  await page.getByRole('button', { name: /Neuf uniquement/ }).click()
  await page.waitForTimeout(500)
  await page.locator('#podium-title').scrollIntoViewIfNeeded()
  report.push(`  neuf : ${(await page.locator('main [aria-live="polite"]').last().textContent())?.trim()}`)
})
await shoot('desktop-neuf-cartes', { width: 1440, height: 1000 }, async (page) => {
  await page.getByRole('button', { name: /Neuf uniquement/ }).click()
  await page.waitForTimeout(500)
  await page.locator('article').first().scrollIntoViewIfNeeded()
  report.push(`  1re carte neuf : ${(await page.locator('article').first().innerText()).replace(/\s+/g, ' ').slice(0, 300)}`)
})
await shoot('desktop-neuf-fiche', { width: 1440, height: 1000 }, async (page) => {
  await page.getByRole('button', { name: /Neuf uniquement/ }).click()
  await page.locator('article button').first().click()
  await page.waitForTimeout(800)
})
await shoot('desktop-tableau', { width: 1440, height: 1000 }, async (page) => {
  await page.getByRole('button', { name: /Neuf uniquement/ }).click()
  await page.getByRole('button', { name: 'Tableau' }).click()
  await page.waitForTimeout(500)
  await page.locator('table').scrollIntoViewIfNeeded()
})
await shoot('mobile-neuf', { width: 390, height: 844 }, async (page) => {
  await page.getByRole('button', { name: /Neuf uniquement/ }).click()
  await page.waitForTimeout(500)
  await page.locator('article').first().scrollIntoViewIfNeeded()
})
writeFileSync('probe/report.txt', report.join('\n') + '\n')
console.log(report.join('\n'))
await browser.close()
