import './mute-auto.mjs'
// 検査一式。node verify.mjs（重いので必要な時だけ）。物理とコースは Node のテストを先に回す
import { chromium, webkit } from 'playwright'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = process.env.VPORT || '5936'
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT }, stdio: 'ignore' })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }

// 1. Node の検査（物理・コース・湯気）
await t('コース: 雪玉なしでは届かず、決めた大きさなら登れる', () => { const o = execFileSync('node', ['tools/t_course.mjs'], { cwd: ROOT }).toString(); expect(/NG 0件/.test(o), o); return true })
await t('湯気: 待てば必ず通れ、突っ走ると半分以上失敗', () => {
  const o = execFileSync('node', ['tools/t_steam.mjs'], { cwd: ROOT }).toString()
  const rush = +/待たない.*成功 (\d+)\//.exec(o)[1], wait = +/待つ.*成功 (\d+)\//.exec(o)[1]
  expect(wait === 8 && rush <= 4, o); return { rush, wait }
})

async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0, { waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.__snowReady, null, { timeout: 300000 })
  return p
}
const inView = (p, sel) => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }, sel)

// 2. スマホ（Chromium）
const cb = await chromium.launch()
const sp = await open(cb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('スマホ: タイトルが一画面・はみ出しなし', async () => { const r = await sp.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, sh: document.documentElement.scrollHeight, h: innerHeight })); expect(r.sw <= r.w && r.sh <= r.h, JSON.stringify(r)); expect(await inView(sp, '#startBtn'), 'start 画面外'); return true })
await sp.screenshot({ path: ROOT + '/shots/v_phone_title.png', timeout: 180000 }).catch(e => console.log('shot skip', e.message.split('\n')[0]))
await t('スマホ: はじめから → 操作ボタンが画面内', async () => {
  const sb = await sp.evaluate(() => { const r = document.querySelector('#startBtn').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  await sp.touchscreen.tap(sb.x, sb.y); await sp.waitForFunction(() => snow.state() === 'play', null, { timeout: 120000 }); await sp.waitForTimeout(800)
  for (const s of ['#bJump', '#bGrab', '#bMake', '#pauseBtn']) expect(await inView(sp, s), s + ' 画面外')
  return true
})
await t('スマホ: 本物の指で［つくる］→ 雪玉が1つ', async () => {
  await sp.evaluate(() => { snow.dbg.inp = null })
  const r = await sp.evaluate(() => { const e = document.querySelector('#bMake').getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 } })
  await sp.touchscreen.tap(r.x, r.y); await sp.waitForTimeout(600)
  const n = await sp.evaluate(() => snow.W.balls.length); expect(n === 1, 'balls=' + n); return true
})
await t('スマホ: 左下の固定スティックで歩く', async () => {
  const z0 = await sp.evaluate(() => snow.W.p.pos.z)
  const c = await sp.context().newCDPSession(sp)
  const tp = (type, x, y) => c.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
  const sc = await sp.evaluate(() => { const r = document.querySelector('#stick').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  expect(await inView(sp, '#stick'), 'stick 画面外')
  await tp('touchStart', sc.x, sc.y); for (let i = 1; i <= 6; i++) { await tp('touchMove', sc.x, sc.y - i * 10); await sp.waitForTimeout(30) }
  await sp.waitForTimeout(1500); await tp('touchEnd')
  const r = await sp.evaluate(() => ({ z: snow.W.p.pos.z, b: snow.W.balls[0] && snow.W.balls[0].pos.z }))
  expect(r.z - z0 > 1.5, JSON.stringify({ z0, ...r })); return { moved: +(r.z - z0).toFixed(1) }
})
await sp.screenshot({ path: ROOT + '/shots/v_phone_play.png', timeout: 180000 }).catch(e => console.log('shot skip', e.message.split('\n')[0]))
await t('スマホ: エラー 0', () => { expect(sp.errs.length === 0, sp.errs.join(' | ')); return true })
await t('音: Chromium で鳴っていない', async () => { const r = await sp.evaluate(() => window.__muteOk ? window.__muteOk() : true); expect(r, 'muteOk=false'); return true })
await sp.context().close()

// 3. PC（Chromium）キーボード
const pc = await open(cb, { viewport: { width: 1280, height: 720 } })
await t('PC: Space で跳ぶ・Q で作る・E で持つ', async () => {
  await pc.click('#startBtn'); await pc.waitForTimeout(500)
  await pc.keyboard.press('q'); await pc.waitForTimeout(300)
  const n = await pc.evaluate(() => snow.W.balls.length)
  await pc.keyboard.press('e'); await pc.waitForTimeout(300)
  const held = await pc.evaluate(() => !!snow.W.p.hold)
  await pc.keyboard.press('e'); await pc.waitForTimeout(200)
  const y0 = await pc.evaluate(() => snow.W.p.pos.y)
  await pc.keyboard.down('Space'); await pc.waitForTimeout(200); const y1 = await pc.evaluate(() => snow.W.p.pos.y); await pc.keyboard.up('Space')
  expect(n === 1 && held && y1 > y0 + 0.3, JSON.stringify({ n, held, y0, y1 })); return true
})
await t('PC: 谷へ落ちると旗に戻る', async () => {
  await pc.evaluate(() => { snow.W.p.pos = { x: 30, y: 0, z: 0 } }); await pc.waitForFunction(() => snow.W.p.pos.x < 2, null, { timeout: 60000 }).catch(() => {})
  const r = await pc.evaluate(() => snow.W.p.pos); expect(Math.abs(r.x) < 2 && Math.abs(r.z + 1) < 2, JSON.stringify(r)); return true
})
await pc.screenshot({ path: ROOT + '/shots/v_pc_play.png', timeout: 180000 }).catch(e => console.log('shot skip', e.message.split('\n')[0]))
await t('PC: エラー 0', () => { expect(pc.errs.length === 0, pc.errs.join(' | ')); return true })
await pc.context().close(); await cb.close()

// 4. WebKit（iOS Safari 相当）
const wb = await webkit.launch()
const wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 始めて雪玉を作れる・エラー 0', async () => {
  await wp.tap('#startBtn'); await wp.waitForTimeout(600); await wp.tap('#bMake'); await wp.waitForTimeout(600)
  const n = await wp.evaluate(() => snow.W.balls.length)
  expect(n === 1 && wp.errs.length === 0, JSON.stringify({ n, errs: wp.errs })); return true
})
await t('音: WebKit で鳴っていない', async () => { const r = await wp.evaluate(() => window.__muteOk ? window.__muteOk() : true); expect(r, 'muteOk=false'); return true })
await wb.close()

console.log(results.join('\n'))
console.log(`\n${pass} ok / ${fail} fail`)
server.kill()
process.exit(fail ? 1 : 0)
