// SNS 用画像 og.png（1200x630）。遊んでいる場面（崖の下に押した雪玉に乗る）＋題名
import './mute-auto.mjs'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const PORT = process.env.PORT || '5934'
const srv = spawn('node', ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT }, stdio: 'ignore' })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, locale: 'ja-JP' })
await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' })
await p.waitForFunction(() => window.__snowReady, null, { timeout: 120000 })
await p.evaluate(() => {
  snow.begin(false); snow.dbg.paused = true
  const W = snow.W
  // ふもとの崖の下（段の上 1.8m）に大きい雪玉、人はその上
  const b = snow.makeBall(-1.2, 1.8 + 0.8, 21.15, 0.8)
  W.p.pos = { x: -1.2, y: 1.8 + 1.62, z: 21.15 }; W.p.yaw = 0.15
  const b2 = snow.makeBall(3.2, 1.8 + 0.42, 16.5, 0.42)
  snow.dbg.inp = () => ({}); snow.dbg.steps = 2
  snow.cam.yaw = Math.PI + 0.75; snow.cam.pitch = 0.28; snow.cam.extra = 1.5
  document.querySelector('#hud').hidden = true
})
await p.waitForTimeout(2500)
await p.evaluate(() => {
  const d = document.createElement('div')
  d.innerHTML = '<div style="position:fixed;left:56px;bottom:52px;color:#f4f7fb;text-shadow:0 2px 24px #000a"><div style="font:400 82px Marcellus,serif;letter-spacing:.03em;line-height:.95">SKY<br>SNOWBALL</div><div style="font:700 24px \'Zen Kaku Gothic New\',sans-serif;color:#e2c46a;letter-spacing:.25em;margin-top:14px">転がした雪玉が、次の足場になる</div></div>'
  document.body.appendChild(d)
})
await p.waitForTimeout(400)
await p.screenshot({ path: 'og.png' })
await b.close(); srv.kill()
console.log('og.png')
