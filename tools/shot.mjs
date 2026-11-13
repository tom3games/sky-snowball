// 実画面を撮る。node tools/shot.mjs [名前] [区間...]  W=1280 H=720 / TOUCH=1 で 390x844
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const PORT = process.env.PORT || '5932'
const srv = spawn('node', ['server.mjs'], { cwd: import.meta.dirname + '/..', env: { ...process.env, PORT }, stdio: 'ignore' })
await new Promise(r => setTimeout(r, 400))
const name = process.argv[2] || 'shot'
const secs = process.argv.slice(3).map(Number)
const touch = !!process.env.TOUCH
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: touch ? { width: 390, height: 844 } : { width: +(process.env.W || 1280), height: +(process.env.H || 720) }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' })
await p.waitForFunction(() => window.__snowReady, null, { timeout: 90000 }).catch(e => { console.log(errs.join("\n")); throw e })
await p.waitForTimeout(600)
await p.screenshot({ path: `shots/${name}_title.png` })
await p.evaluate(() => snow.begin(false))
for (const s of secs.length ? secs : [0]) {
  await p.evaluate(i => { snow.teleport(i) }, s)
  await p.waitForTimeout(900)
  await p.screenshot({ path: `shots/${name}_s${s}.png` })
}
console.log(errs.length ? errs.join('\n') : 'エラー 0')
await b.close(); srv.kill()
