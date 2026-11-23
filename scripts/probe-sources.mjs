// Sonde des sites de vélos neufs : lit chaque adresse depuis la machine GitHub, comme la
// lecture directe de la veille, et enregistre la page pour en étudier la structure.
// Lancée à la main par le workflow « Sonde des sources » (aucun effet sur le site).
import { mkdirSync, writeFileSync } from 'node:fs'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.6',
}

const urls = (process.env.PROBE_URLS || '').split(/\s+/).filter(Boolean)
mkdirSync('probe', { recursive: true })
let i = 0
for (const url of urls) {
  i++
  const name = String(i).padStart(2, '0') + '-' + url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 80)
  try {
    const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(25000) })
    const body = await res.text()
    writeFileSync(`probe/${name}.${/json/.test(res.headers.get('content-type') || '') ? 'json' : 'html'}`, body)
    const title = body.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim().slice(0, 90) ?? ''
    const ld = (body.match(/application\/ld\+json/g) || []).length
    const types = [...new Set([...body.matchAll(/"@type"\s*:\s*"(\w+)"/g)].map((m) => m[1]))].slice(0, 8).join(',')
    const euros = (body.match(/\d[\d\s.  ]{2,6}(?:,\d{2})?\s?(?:€|&euro;|EUR)/g) || []).length
    const flags = ['__NEXT_DATA__', '__NUXT__', 'window.__INITIAL_STATE__', 'data-product', 'cf-chl', 'datadome', 'captcha', 'akamai', 'strikethrough', 'price-old', 'was-price', 'line-through']
      .filter((f) => body.toLowerCase().includes(f.toLowerCase()))
      .join(',')
    console.log(`${res.status} ${String(body.length).padStart(8)} o  ld=${ld} [${types}] €=${euros} {${flags}} ${title}\n    ${url} → ${res.url}`)
  } catch (error) {
    console.log(`ERR ${error.message}\n    ${url}`)
  }
  await new Promise((r) => setTimeout(r, 700))
}
