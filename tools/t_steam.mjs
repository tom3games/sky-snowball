// 湯気の区間: 始める時刻をずらして、待たない／待つの到着時の大きさ
import { createWorld, step, makeBall } from '../js/phys.js'
import { COURSE } from '../js/course.js'
const H = COURSE.H
function steer(W, b, tx, tz) { const p = W.p.pos, dx = tx - b.pos.x, dz = tz - b.pos.z, d = Math.hypot(dx, dz) || 1; const bx = b.pos.x - dx / d * (b.r + 0.5), bz = b.pos.z - dz / d * (b.r + 0.5); const ex = bx - p.x, ez = bz - p.z, e = Math.hypot(ex, ez); return e > 0.6 ? { mx: ex / e, mz: ez / e } : { mx: dx / d, mz: dz / d } }
const res = { rush: [], wait: [] }
for (const wait of [false, true]) for (let off = 0; off < 12; off += 1.5) {
  const W = createWorld(COURSE); W.t = off
  W.p.pos = { x: -3, y: H.y4, z: 103 }
  const b = makeBall(W, -3, H.y4 + 1.15, 105.5, 1.15)
  let t = 0
  for (; t < 120 * 60; t++) {
    const z = W.zones.find(z => z.id === 'sun4'); const ph = (W.t + (z.phase || 0)) % z.period
    const atGate = (b.pos.z > 106 && b.pos.z < 107.3) || (b.pos.z > 116.4 && b.pos.z < 117.6)
    const go = !wait || !atGate || (ph >= z.on && ph < z.period - 1.2)
    step(W, go ? steer(W, b, -3, 127) : {})
    if (b.pos.z > 124.5 || !W.balls.includes(b)) break
  }
  res[wait ? 'wait' : 'rush'].push(W.balls.includes(b) ? +b.r.toFixed(2) : 0)
}
const ok = a => a.filter(r => r >= 0.78).length
console.log('待たない', res.rush.join(' '), `成功 ${ok(res.rush)}/${res.rush.length}`)
console.log('待つ    ', res.wait.join(' '), `成功 ${ok(res.wait)}/${res.wait.length}`)
