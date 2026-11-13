// 手ざわりの数字（ブラウザなし）。node tools/t_feel.mjs
import { createWorld, step, makeBall, K, DT } from '../js/phys.js'

const flat = (extra = []) => ({ boxes: [{ x: 0, y: -1, z: 0, w: 80, h: 2, d: 80, mat: 'snow' }, ...extra], flags: [{ x: 0, y: 0, z: 0 }], killY: -50, start: { x: 0, y: 0, z: 0 } })
const run = (W, n, f) => { for (let i = 0; i < n; i++) step(W, f(i, W) || {}) }

// 1. 跳ばずに・跳んで登れる高さ
function climbs(H, jump) {
  const W = createWorld(flat([{ x: 0, y: H / 2, z: 5, w: 10, h: H, d: 4, mat: 'rock' }]))
  let ok = false
  run(W, 240, (i) => { if (W.p.pos.y > H - 0.05 && W.p.pos.z > 3) ok = true; return { mz: 1, jump: jump && i % 30 === 10, jumpHeld: true } })
  return ok
}
let maxStand = 0, maxJump = 0
for (let H = 0.4; H < 3.5; H += 0.05) { if (climbs(H, false)) maxStand = H; if (climbs(H, true)) maxJump = H }
console.log('登れる高さ: 跳ばず', maxStand.toFixed(2), 'm / 跳んで', maxJump.toFixed(2), 'm')

// 2. 雪玉に乗って届く崖
function ballCliff(r, H) {
  const W = createWorld(flat([{ x: 0, y: H / 2, z: 5 + r, w: 10, h: H, d: 4, mat: 'rock' }]))
  const b = makeBall(W, 0, r, 3 + r - r, r); b.pos.z = 3 + r - 0.001 - r + r // 崖に接する
  b.pos.z = 3 + r; b.pos.z = (5 + r - 2) - r
  W.p.pos.x = 0; W.p.pos.y = 2 * r + 0.05; W.p.pos.z = b.pos.z
  let ok = false
  run(W, 300, (i) => { if (W.p.pos.y > H - 0.05 && W.p.pos.z > 3 + r) ok = true; return { mz: 1, jump: i % 40 === 20, jumpHeld: true } })
  return ok
}
for (const r of [0.4, 0.5, 0.7, 0.8, 1.0, 1.2]) {
  let best = 0
  for (let H = 1; H < 6; H += 0.05) if (ballCliff(r, H)) best = H
  console.log(`r=${r} 雪玉の上から届く崖`, best.toFixed(2), `（雪玉のてっぺん ${(2 * r).toFixed(2)}m）`)
}

// 3. 押して運ぶ速さと太り方
for (const r0 of [0.3, 0.6, 0.8, 1.0, 1.15, 1.25]) {
  const W = createWorld(flat())
  const b = makeBall(W, 0, r0, 1.2, r0)
  W.p.pos.z = 1.2 - r0 - 0.4
  W.balls[0].r = r0
  let t = 0
  const z0 = b.pos.z
  run(W, 300, () => ({ mz: 1 }))
  const v = (b.pos.z - z0) / 5
  console.log(`押す r0=${r0}: 5秒で ${(b.pos.z - z0).toFixed(1)}m（${v.toFixed(2)}m/s）→ r=${b.r.toFixed(2)}`)
}
// 太る距離
{ const W = createWorld(flat()); const b = makeBall(W, 0, 0.3, 1.2, 0.3); W.p.pos.z = 0.5
  const marks = [0.5, 0.7, 0.9, 1.0, 1.2]; let mi = 0, z0 = b.pos.z
  run(W, 60 * 40, () => { if (mi < marks.length && b.r >= marks[mi]) { console.log(`  r=${marks[mi]} まで ${(b.pos.z - z0).toFixed(1)}m`); mi++ } return { mz: 1 } }) }

// 4. 坂で止まるか
function slope(deg, r) {
  const a = deg * Math.PI / 180
  const W = createWorld(flat([{ x: 0, y: 0, z: 0, w: 20, h: 1, d: 30, pitch: -a, mat: 'snow' }]))
  const b = makeBall(W, 0, 0.5 + r + 0.5 * Math.cos(a) * 0, 0, r)
  b.pos.y = 0.5 / Math.cos(a) + r / Math.cos(a)
  W.p.pos.x = 8; W.p.pos.y = 20
  run(W, 180, () => ({}))
  return Math.hypot(b.pos.z, 0) > 0.3 ? `転がる(${b.pos.z.toFixed(1)}m)` : '止まる'
}
for (const r of [0.3, 0.45, 0.55, 0.7, 1.0]) console.log(`18度の坂 r=${r}:`, slope(18, r), ' / 10度:', slope(10, r))

// 5. 18度の坂を押し上げられるか
for (const r0 of [0.4, 0.6, 0.75, 0.9]) {
  const a = 18 * Math.PI / 180
  const W = createWorld(flat([{ x: 0, y: -Math.cos(a) * 1.5 + 0, z: 0, w: 20, h: 3, d: 60, pitch: -a, mat: 'rock' }]))
  // 面の上: y = z*tan(a)
  const b = makeBall(W, 0, 0, 0, r0); b.pos.z = 0; b.pos.y = r0 / Math.cos(a)
  W.p.pos.z = -r0 - 0.5; W.p.pos.y = W.p.pos.z * Math.tan(a) + 0.2
  const z0 = b.pos.z
  run(W, 300, () => ({ mz: 1 }))
  console.log(`18度の岩の坂を押す r=${r0}: 5秒で ${(b.pos.z - z0).toFixed(1)}m`)
}
