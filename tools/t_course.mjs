// 区間ごとに「雪玉なしでは登れない／決めた大きさの雪玉なら登れる」を実コースで確かめる。node tools/t_course.mjs
import { createWorld, step, makeBall } from '../js/phys.js'
import { COURSE } from '../js/course.js'
const H = COURSE.H
function tryClimb({ px, py, pz, dir = [0, 1], high, balls = [], secs = 5, label, far }) {
  const W = createWorld(COURSE)
  W.zones = W.zones.filter(z => z.kind !== 'sun') // 湯気で溶けるのは別の検査で見る
  W.p.pos = { x: px, y: py, z: pz }; W.p.vel = { x: 0, y: 0, z: 0 }; W.p.yaw = Math.atan2(dir[0], dir[1])
  const made = balls.map(b => { const o = makeBall(W, b.x, b.y, b.z, b.r); return o })
  balls.forEach((b, i) => { if (b.on != null) { made[i].on = made[b.on] } })
  let ok = false
  for (let i = 0; i < secs * 60; i++) {
    step(W, { mx: dir[0], mz: dir[1], jump: far ? (W.p.pos.z > 69.7 && W.p.ground) : i % 45 === 20, jumpHeld: true })
    if (W.p.pos.y > high - 0.12 && W.p.ground && (!far || W.p.pos.z > 73.6)) { ok = true; break }
  }
  return ok
}
const cases = []
const C = (name, base, withBall) => cases.push({ name, base, withBall })
// 0 ふもと: 段 1.8 → 4.8（z=22）
C('ふもと', { px: 0, py: 1.8, pz: 21.3, high: 4.8 }, { balls: [{ x: 0, y: 1.8 + 0.45, z: 22 - 0.45, r: 0.45 }], px: 0, py: 1.8 + 0.92, pz: 22 - 0.45 })
// 1 くぼみ: くぼみ yTop1 → y2（z=46）
C('くぼみの坂', { px: 0, py: H.yTop1, pz: 45.4, high: H.y2 }, { balls: [{ x: 0, y: H.yTop1 + 0.8, z: 46 - 0.8, r: 0.8 }], px: 0, py: H.yTop1 + 1.62, pz: 46 - 0.8 })
// 2 穴: 底 pitY → y2（z=73.4）
C('岩場と穴', { px: 0, py: H.pitY, pz: 72.8, high: H.y2 }, { balls: [{ x: 0, y: H.pitY + 0.95, z: 73.4 - 0.95, r: 0.95 }], px: 0, py: H.pitY + 1.92, pz: 73.4 - 0.95 })
// 2' 穴の手前から跳び越せない
C('穴を跳び越す', { px: 0, py: H.y2, pz: 66, high: H.y2, far: true }, null)
// 3 雪だるま: y3 → y4（z=98）。1個（最大 1.2）では届かない、重ねれば届く
C('雪だるま(1個1.2)', { px: 0, py: H.y3 + 2.42, pz: 98 - 1.2, high: H.y4, balls: [{ x: 0, y: H.y3 + 1.2, z: 98 - 1.2, r: 1.2 }] }, { balls: [{ x: 4.1, y: H.y3 + 1.1, z: 98 - 1.1, r: 1.1 }, { x: 4.1, y: H.y3 + 2.6, z: 98 - 1.1, r: 0.5, on: 0 }], px: 4.1, py: H.y3 + 3.2, pz: 98 - 1.1 })
C('雪だるま(岩棚から)', { px: 7, py: H.y3 + 2, pz: 97.3, high: H.y4 }, null)
// 4 日なた: y4 → y5（z=126）
C('日なた', { px: -3, py: H.y4, pz: 125.4, high: H.y5 }, { balls: [{ x: -3, y: H.y4 + 0.78, z: 126 - 0.78, r: 0.78 }], px: -3, py: H.y4 + 1.6, pz: 126 - 0.78 })
// 5 氷: → y6（z=150）
C('氷の床', { px: -4, py: H.y5 + 0.3, pz: 149.4, high: H.y6 }, { balls: [{ x: -4, y: H.y5 + 0.3 + 0.85, z: 150 - 0.85, r: 0.85 }], px: -4, py: H.y5 + 2.1, pz: 150 - 0.85 })
// 6 吹雪: y6 → y7（z=176）
C('吹雪の尾根', { px: -4, py: H.y6, pz: 175.4, high: H.y7 }, { balls: [{ x: -4, y: H.y6 + 0.97, z: 176 - 0.97, r: 0.97 }], px: -4, py: H.y6 + 1.96, pz: 176 - 0.97 })
// 7 深雪: dBot → ySum（z=216）
C('深い新雪', { px: -2, py: H.dBot, pz: 215.4, high: H.y9 }, { balls: [{ x: -2, y: H.dBot + 0.78, z: 216 - 0.78, r: 0.78 }], px: -2, py: H.dBot + 1.6, pz: 216 - 0.78 })

// 8 氷の壁 → y10（z=252）, 9 → 山頂（z=272）
C('氷の壁の先の崖', { px: 0, py: H.y9, pz: 251.4, high: H.y10 }, { balls: [{ x: 0, y: H.y9 + 0.8, z: 252 - 0.8, r: 0.8 }], px: 0, py: H.y9 + 1.62, pz: 252 - 0.8 })
C('山頂の崖', { px: 0, py: H.y10, pz: 271.4, high: H.ySum }, { balls: [{ x: 0, y: H.y10 + 0.85, z: 272 - 0.85, r: 0.85 }], px: 0, py: H.y10 + 1.72, pz: 272 - 0.85 })

let ng = 0
for (const c of cases) {
  const without = tryClimb(c.base)
  let withB = null
  if (c.withBall) withB = tryClimb({ ...c.base, ...c.withBall })
  const good = !without && (withB === null || withB)
  if (!good) ng++
  console.log(`${good ? 'OK' : 'NG'} ${c.name}: 雪玉なし ${without ? '登れた' : '届かない'}${withB === null ? '' : ' / 雪玉あり ' + (withB ? '登れた' : '届かない')}`)
}
// 氷の壁: 押しただけでは割れない／坂から走らせると割れる
{
  const wall = () => { const W = createWorld(COURSE); return { W, w: W.boxes.find(b => b.breakable) } }
  let { W, w } = wall(); W.p.pos = { x: 2, y: H.y9, z: 228 }
  const b1 = makeBall(W, 2, H.y9 + 0.95, 230.2, 0.95)
  for (let i = 0; i < 300; i++) step(W, { mz: 1 })
  const pushBreak = !w.on
  ;({ W, w } = wall()); W.p.pos = { x: -5.5, y: H.y9 + 2, z: 220 }
  const b2 = makeBall(W, -5.5, H.y9 + 2 + 0.85, 222.2, 0.85)
  for (let i = 0; i < 300; i++) step(W, { mz: 1 })
  const rollBreak = !w.on
  ;({ W, w } = wall()); W.p.pos = { x: -5.5, y: H.y9 + 2, z: 220 }
  makeBall(W, -5.5, H.y9 + 2 + 0.45, 222.2, 0.45)
  for (let i = 0; i < 300; i++) step(W, { mz: 1 })
  const smallBreak = !w.on
  const good = !pushBreak && rollBreak && !smallBreak
  if (!good) ng++
  console.log(`${good ? 'OK' : 'NG'} 氷の壁: 平らで押す(0.95) ${pushBreak ? '割れた' : '割れない'} / 坂から(0.85) ${rollBreak ? '割れた' : '割れない'} / 坂から小(0.45) ${smallBreak ? '割れた' : '割れない'}`)
}
// 重りの門: 半径1.0 で開く、0.8 では開かない、どけると閉じる
{
  const res = []
  for (const r of [0.8, 1.02]) {
    const W = createWorld(COURSE); W.p.pos = { x: -6, y: H.y10, z: 255 }
    makeBall(W, 3.5, H.y10 + 0.2 + r, 259, r)
    for (let i = 0; i < 180; i++) step(W, {})
    const g = W.boxes.find(b => b.gate)
    res.push(g.c.y < g.y - 4)
  }
  const good = !res[0] && res[1]
  if (!good) ng++
  console.log(`${good ? 'OK' : 'NG'} 重りの門: 半径0.8 ${res[0] ? '開いた' : '開かない'} / 1.02 ${res[1] ? '開いた' : '開かない'}`)
}
// 重りの門: 開いた門の下に立っている間に玉をどけても、人は門の上に押し出されない
{
  const W = createWorld(COURSE)
  const b = makeBall(W, 3.5, H.y10 + 0.2 + 1.02, 259, 1.02)
  W.p.pos = { x: -1.5, y: H.y10, z: 264 }
  for (let i = 0; i < 240; i++) step(W, {})
  W.p.pos = { x: -1.5, y: H.y10, z: 266.6 }
  b.pos.x = -6 // 踏み板からどける
  for (let i = 0; i < 300; i++) step(W, {})
  const y = W.p.pos.y
  W.p.pos = { x: -1.5, y: H.y10, z: 269 }
  for (let i = 0; i < 400; i++) step(W, {})
  const g = W.boxes.find(o => o.gate)
  const good = y < H.y10 + 0.5 && g.c.y > g.y - 0.2
  if (!good) ng++
  console.log(`${good ? 'OK' : 'NG'} 重りの門: 下に人がいる間は閉まらない（人の高さ ${(y - H.y10).toFixed(2)}m）・どいたら閉まる`)
}
console.log(ng ? `NG ${ng}件` : 'NG 0件')
process.exit(ng ? 1 : 0)
