// 台本どおりに遊んで撮る。node tools/play.mjs
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const PORT = process.env.PORT || '5933'
const srv = spawn('node', ['server.mjs'], { cwd: import.meta.dirname + '/..', env: { ...process.env, PORT }, stdio: 'ignore' })
await new Promise(r => setTimeout(r, 400))
const touch = !!process.env.TOUCH
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 720 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1, locale: 'ja-JP' })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' })
await p.waitForFunction(() => window.__snowReady, null, { timeout: 120000 })
const name = process.env.NAME || 'play'
await p.waitForTimeout(500)
await p.screenshot({ path: `shots/${name}_0title.png` })
// 台本: [秒, 入力]
const run = async (sec, inp) => {
  await p.evaluate(([sec, inp]) => {
    snow.dbg.paused = true
    let n = Math.round(sec * 60), first = true
    snow.dbg.inp = (W) => { const o = { ...inp }; if (!first) { o.jump = false; o.grab = false; o.make = false } first = false; return o }
    snow.dbg.steps = n
  }, [sec, inp])
  await p.waitForFunction(() => snow.dbg.steps === 0, null, { timeout: 60000 })
  await p.waitForTimeout(150)
}
await p.evaluate(() => snow.begin(false))
await p.evaluate(() => { snow.dbg.paused = true })
// ふもと: 段 1.8 に登ってから雪玉
await run(3.4, { mz: 1 })
await run(0.5, { mz: 1, jump: true, jumpHeld: true })
await run(0.9, { mz: 1 })
await p.screenshot({ path: `shots/${name}_1climbed.png` })
await run(0.1, { mz: 0.01, make: true })
await p.screenshot({ path: `shots/${name}_2made.png` })
// 雪玉を左右に転がして育てる
await run(2.2, { mx: 0.0, mz: 1 })
await p.screenshot({ path: `shots/${name}_3push.png` })
const s1 = await p.evaluate(() => snow.snapshot())
await run(2.0, { mz: 1 })
const s2 = await p.evaluate(() => snow.snapshot())
await p.screenshot({ path: `shots/${name}_4atcliff.png` })
// 乗る: 少し下がって跳ぶ
await run(0.5, { mz: -1 })
await run(0.6, { mz: 1, jump: true, jumpHeld: true })
await run(0.8, { mz: 1 })
await p.screenshot({ path: `shots/${name}_5onball.png` })
await run(0.6, { mz: 1, jump: true, jumpHeld: true })
await run(1.0, { mz: 1 })
const s3 = await p.evaluate(() => snow.snapshot())
await p.screenshot({ path: `shots/${name}_6top.png` })
console.log(JSON.stringify({ s1: s1.balls, s2: s2.balls, p2: s2.p, p3: s3.p, flag: s3.flag }))
console.log(await p.evaluate(() => ({ hero: snow.view.hero.ready })))
console.log(errs.length ? errs.join('\n') : 'エラー 0')
await b.close(); srv.kill()
