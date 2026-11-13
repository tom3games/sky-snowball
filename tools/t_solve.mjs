// 実際に押して解けるか（坂・湯気・穴）。node tools/t_solve.mjs
import { createWorld, step, makeBall } from '../js/phys.js'
import { COURSE } from '../js/course.js'
const H = COURSE.H
function steer(W, b, tx, tz) {
  // 玉の後ろ（目標と反対側）に回り込み、目標へ押す
  const p = W.p.pos, dx = tx - b.pos.x, dz = tz - b.pos.z, d = Math.hypot(dx, dz) || 1
  const bx = b.pos.x - dx / d * (b.r + 0.5), bz = b.pos.z - dz / d * (b.r + 0.5)
  const ex = bx - p.x, ez = bz - p.z, e = Math.hypot(ex, ez)
  if (e > 0.6) { // 回り込む（玉に当たらないよう横へ）
    return { mx: ex / e, mz: ez / e }
  }
  return { mx: dx / d, mz: dz / d }
}
// 坂: 下で作って押し上げる
{
  const W = createWorld(COURSE)
  W.p.pos = { x: 0, y: 4.8, z: 26 }
  const b = makeBall(W, 0, 4.8 + 0.3, 27.5, 0.3)
  let t = 0, maxR = 0
  for (; t < 60 * 60; t++) { step(W, steer(W, b, 0, 46)); if (b.pos.z > 44.2 && Math.abs(b.vel.z) < 0.2) break; if (!W.balls.includes(b)) break }
  console.log(`坂: ${(t / 60).toFixed(1)}秒で z=${b.pos.z.toFixed(1)} r=${b.r.toFixed(2)}（必要 0.78）`)
  // 手を離すと止まるか
  for (let i = 0; i < 180; i++) step(W, {})
  console.log(`  離して3秒後 z=${b.pos.z.toFixed(1)}`)
}
// 坂の途中で離すと転がり落ちる
{
  const W = createWorld(COURSE)
  W.p.pos = { x: 0, y: 4.8, z: 26 }
  const b = makeBall(W, 0, 5.1, 27.5, 0.3)
  for (let t = 0; t < 60 * 60; t++) { step(W, steer(W, b, 0, 46)); if (b.pos.z > 39) break }
  const r = b.r
  for (let i = 0; i < 240; i++) step(W, { mz: -1 })
  console.log(`坂の途中(z=39, r=${r.toFixed(2)})で離すと 4秒後 z=${b.pos.z.toFixed(1)}`)
}
// 湯気の道: r 1.15 で始めて押し通す（湯気の周期どおり）
for (const wait of [false, true]) {
  const W = createWorld(COURSE)
  W.p.pos = { x: -3, y: H.y4, z: 103 }
  const b = makeBall(W, -3, H.y4 + 1.1, 105.5, 1.1)
  let t = 0
  for (; t < 90 * 60; t++) {
    const z = W.zones.find(z => z.id === 'sun4'); const ph = (W.t + (z.phase || 0)) % z.period
    const atGate = (b.pos.z > 106 && b.pos.z < 107.3) || (b.pos.z > 116.4 && b.pos.z < 117.6)
    const go = !wait || !atGate || (ph >= z.on && ph < z.period - 1.5)
    step(W, go ? steer(W, b, -3, 127) : {})
    if (b.pos.z > 124.5 || !W.balls.includes(b)) break
  }
  console.log(`湯気${wait ? '（止むのを待つ）' : '（待たない）'}: ${(t / 60).toFixed(1)}秒 z=${b.pos.z.toFixed(1)} r=${W.balls.includes(b) ? b.r.toFixed(2) : '溶けた'}（必要 0.78）`)
}
