// 物理。固定 60Hz（1刻み 1/60 秒）で、同じ入力なら同じ結果。three.js に頼らないので Node でも回せる。
// 世界は「向きを持った箱（OBB）」だけで作る。見た目のメッシュも同じ箱から作る（当たりと見た目が同じデータ）。
// 人は球2つ（足・胴）、雪玉は球。雪玉は雪の上を転がった距離で太り、日なたで溶け、岩・氷の上では太らない。

export const DT = 1 / 60
export const G = 20
export const K = {
  pr: 0.34,            // 人の球の半径
  feetY: 0.34, bodyY: 1.22,
  walk: 4.3, deep: 1.05, carry: 3.4,
  accG: 34, accAir: 9, accIce: 5,
  jumpV: 6.3,          // 頂点まで約 1.0m
  coyote: 0.12, buffer: 0.12,
  reachStand: 1.15,    // 立ったまま（跳ばずに）手を掛けられる高さ
  reachAir: 1.25,      // 跳んでいる時、足からこの高さまで手が届く（地面から跳ぶと約 2.2m の段まで）
  mantleT: 0.55,
  rMin: 0.24, rMax: 2.2, grow: 0.05, // r² が「雪の上を転がった距離 × grow」ずつ増える
  melt: 0.2,         // 日なたで半径が毎秒これだけ縮む
  rGrab: 0.56,         // 持ち上げられる大きさ
  rPush: 1.22,         // これより大きいと押しても動かない
  ballsMax: 9,
}

// ---- 小さなベクトル ----
const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z })
const add = (a, b, s = 1) => { a.x += b.x * s; a.y += b.y * s; a.z += b.z * s; return a }
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const len = a => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z)
const clamp = (x, a, b) => x < a ? a : x > b ? b : x

// ---- 箱 ----
// def: { x,y,z 中心, w,h,d 全幅, yaw, pitch, roll（ラジアン）, mat, ...任意 }
export function makeBox(def) {
  const cy = Math.cos(def.yaw || 0), sy = Math.sin(def.yaw || 0)
  const cp = Math.cos(def.pitch || 0), sp = Math.sin(def.pitch || 0)
  const cr = Math.cos(def.roll || 0), sr = Math.sin(def.roll || 0)
  // R = Ry * Rx * Rz（列ベクトルが箱のローカル軸）
  // Rz
  const zx = v3(cr, sr, 0), zy = v3(-sr, cr, 0), zz = v3(0, 0, 1)
  // Rx を掛ける
  const rx = a => v3(a.x, cp * a.y - sp * a.z, sp * a.y + cp * a.z)
  const ry = a => v3(cy * a.x + sy * a.z, a.y, -sy * a.x + cy * a.z)
  const ax = ry(rx(zx)), ay = ry(rx(zy)), az = ry(rx(zz))
  const b = { ...def, c: v3(def.x, def.y, def.z), h: v3(def.w / 2, def.h / 2, def.d / 2), ax, ay, az, on: true }
  boxAabb(b)
  return b
}
export function boxAabb(b) {
  const ex = Math.abs(b.ax.x) * b.h.x + Math.abs(b.ay.x) * b.h.y + Math.abs(b.az.x) * b.h.z
  const ey = Math.abs(b.ax.y) * b.h.x + Math.abs(b.ay.y) * b.h.y + Math.abs(b.az.y) * b.h.z
  const ez = Math.abs(b.ax.z) * b.h.x + Math.abs(b.ay.z) * b.h.y + Math.abs(b.az.z) * b.h.z
  b.min = v3(b.c.x - ex, b.c.y - ey, b.c.z - ez); b.max = v3(b.c.x + ex, b.c.y + ey, b.c.z + ez)
}

// 球と箱。重なっていれば { n: 箱から外向き, d: めり込み } を返す
const _d = v3(), _q = v3()
export function sphereBox(p, r, b) {
  if (!b.on) return null
  if (p.x + r < b.min.x || p.x - r > b.max.x || p.y + r < b.min.y || p.y - r > b.max.y || p.z + r < b.min.z || p.z - r > b.max.z) return null
  _d.x = p.x - b.c.x; _d.y = p.y - b.c.y; _d.z = p.z - b.c.z
  const lx = dot(_d, b.ax), ly = dot(_d, b.ay), lz = dot(_d, b.az)
  const qx = clamp(lx, -b.h.x, b.h.x), qy = clamp(ly, -b.h.y, b.h.y), qz = clamp(lz, -b.h.z, b.h.z)
  let nx = lx - qx, ny = ly - qy, nz = lz - qz
  const d2 = nx * nx + ny * ny + nz * nz
  let depth
  if (d2 > 1e-10) {
    if (d2 > r * r) return null
    const dd = Math.sqrt(d2); nx /= dd; ny /= dd; nz /= dd; depth = r - dd
  } else {
    // 中心が箱の中。一番浅い面から出す
    const px = b.h.x - Math.abs(lx), py = b.h.y - Math.abs(ly), pz = b.h.z - Math.abs(lz)
    nx = ny = nz = 0
    if (py <= px && py <= pz) { ny = Math.sign(ly) || 1; depth = r + py }
    else if (px <= pz) { nx = Math.sign(lx) || 1; depth = r + px }
    else { nz = Math.sign(lz) || 1; depth = r + pz }
  }
  const n = v3(b.ax.x * nx + b.ay.x * ny + b.az.x * nz, b.ax.y * nx + b.ay.y * ny + b.az.y * nz, b.ax.z * nx + b.ay.z * ny + b.az.z * nz)
  return { n, d: depth, b }
}

// 下向きなどの光線と箱（slab）。当たれば { t, n }
export function rayBox(o, dir, b, tMax) {
  if (!b.on) return null
  _d.x = o.x - b.c.x; _d.y = o.y - b.c.y; _d.z = o.z - b.c.z
  const lo = [dot(_d, b.ax), dot(_d, b.ay), dot(_d, b.az)]
  const ld = [dot(dir, b.ax), dot(dir, b.ay), dot(dir, b.az)]
  const hh = [b.h.x, b.h.y, b.h.z]
  let t0 = 0, t1 = tMax, axis = -1, sgn = 0
  for (let i = 0; i < 3; i++) {
    if (Math.abs(ld[i]) < 1e-9) { if (lo[i] < -hh[i] || lo[i] > hh[i]) return null; continue }
    let ta = (-hh[i] - lo[i]) / ld[i], tb = (hh[i] - lo[i]) / ld[i], s = -1
    if (ta > tb) { const t = ta; ta = tb; tb = t; s = 1 }
    if (ta > t0) { t0 = ta; axis = i; sgn = s }
    if (tb < t1) t1 = tb
    if (t0 > t1) return null
  }
  if (axis < 0) return null
  const A = [b.ax, b.ay, b.az][axis]
  return { t: t0, n: v3(A.x * sgn, A.y * sgn, A.z * sgn), b }
}

// ---- 世界 ----
export function createWorld(course) {
  const W = {
    t: 0, tick: 0,
    boxes: course.boxes.map(makeBox),
    zones: course.zones || [],
    flags: course.flags.map((f, i) => ({ ...f, i, lit: i === 0 })),
    killY: course.killY,
    balls: [], nextId: 1,
    events: [],
    p: null,
    course,
  }
  for (const b of W.boxes) if (b.plate) b.plateLoad = 0
  W.p = newPlayer(W, course.start)
  W.flag = 0
  return W
}

function newPlayer(W, s) {
  return {
    pos: v3(s.x, s.y, s.z), vel: v3(), yaw: s.yaw || 0,
    ground: false, gn: v3(0, 1, 0), gmat: 'snow', gBall: null, coyote: 0, jumpBuf: 0,
    mantle: null, hold: null, push: null, pushT: 0, fallFrom: s.y, airT: 0, stun: 0,
    wallN: null, deep: false, sliding: false,
  }
}

export function zoneAt(W, kind, p) {
  for (const z of W.zones) {
    if (z.kind !== kind) continue
    if (p.x < z.x0 || p.x > z.x1 || p.z < z.z0 || p.z > z.z1 || p.y < (z.y0 ?? -1e9) || p.y > (z.y1 ?? 1e9)) continue
    if (z.period) { const ph = (W.t + (z.phase || 0)) % z.period; if (ph >= z.on) continue }
    return z
  }
  return null
}
// 日なたの時間割（雲の影が通る）。0〜1: 今の強さ、と次に変わるまでの秒
export function zoneState(W, z) {
  if (!z.period) return { on: true, left: Infinity }
  const ph = (W.t + (z.phase || 0)) % z.period
  return ph < z.on ? { on: true, left: z.on - ph } : { on: false, left: z.period - ph }
}

export function makeBall(W, x, y, z, r) {
  if (W.balls.length >= K.ballsMax) {
    // 一番古い、持っていない・乗っていない雪玉を溶かす
    const old = W.balls.find(b => b !== W.p.hold && b !== W.p.gBall && !W.balls.some(o => o.on === b) && !(b.gBox && b.gBox.plate) && !(W.p.push && W.p.push.b === b))
    if (old) removeBall(W, old, 'melt')
  }
  const b = { id: W.nextId++, pos: v3(x, y, z), vel: v3(), r, ground: false, gn: v3(0, 1, 0), gmat: 'rock', gBox: null,
    rolled: 0, spin: { x: 0, y: 0, z: 0, w: 1 }, on: null, held: false, sun: false, born: W.t, lastHit: 0 }
  W.balls.push(b)
  W.events.push({ k: 'make', id: b.id })
  return b
}
export function removeBall(W, b, why) {
  const i = W.balls.indexOf(b); if (i < 0) return
  W.balls.splice(i, 1)
  for (const o of W.balls) if (o.on === b) { o.on = null; o.vel = v3(b.vel.x, b.vel.y, b.vel.z) }
  if (W.p.hold === b) W.p.hold = null
  if (W.p.gBall === b) W.p.gBall = null
  W.events.push({ k: why || 'gone', id: b.id, x: b.pos.x, y: b.pos.y, z: b.pos.z, r: b.r })
}

// 重なった雪玉の一番下
export const baseOf = b => { let x = b; while (x.on) x = x.on; return x }
// 一番下の雪玉に乗っている分も含めた「重さの半径」
function stackR(W, base) {
  let m = base.r ** 3
  for (const o of W.balls) if (o !== base && baseOf(o) === base) m += o.r ** 3
  return Math.cbrt(m)
}
export const pushShare = r => r > K.rPush ? 0 : 1 / (1 + (r / 0.78) ** 3)
// 押せる力（1 = 歩く速さで押せる）。1.22m を超えると 0
export const pushPow = r => r > K.rPush ? 0 : clamp(1.06 - 0.6 * r, 0.3, 0.92)

// ---- 1刻み ----
// inp: { mx, mz（世界の向き・長さ0〜1）, jump（押した瞬間）, jumpHeld, grab（押した瞬間）, make（押した瞬間） }
export function step(W, inp) {
  W.events.length = 0
  W.t += DT; W.tick++
  stepMovers(W)
  stepPlayer(W, inp)
  for (const b of W.balls.slice()) stepBall(W, b)
  ballPairs(W)
  for (const b of W.balls) if (b.on) followStack(b)
  stepPlates(W)
  // 奈落
  for (const b of W.balls.slice()) if (b.pos.y < W.killY) removeBall(W, b, 'void')
  if (W.p.pos.y < W.killY) respawn(W, 'void')
  // 旗
  for (const f of W.flags) {
    if (f.lit && f.i <= W.flag) continue
    const dx = W.p.pos.x - f.x, dz = W.p.pos.z - f.z, dy = W.p.pos.y - f.y
    if (dx * dx + dz * dz < 2.2 * 2.2 && Math.abs(dy) < 2) {
      f.lit = true
      if (f.i > W.flag) { W.flag = f.i; W.events.push({ k: 'flag', i: f.i }) }
    }
  }
}

export function respawn(W, why) {
  const f = W.flags[W.flag], p = W.p
  if (p.hold) { const h = p.hold; p.hold = null; h.held = false }
  p.pos = v3(f.x, f.y + 0.05, f.z); p.vel = v3(); p.yaw = f.yaw ?? p.yaw
  p.mantle = null; p.ground = false; p.gBall = null; p.fallFrom = f.y; p.stun = 0
  W.events.push({ k: 'respawn', why })
}

function stepMovers(W) {
  for (const b of W.boxes) {
    if (!b.gate) continue
    const open = b.gateOpen ? 1 : 0
    b.gateT = (b.gateT ?? 0) + clamp(open - (b.gateT ?? 0), -DT * 0.8, DT * 0.8)
    const y = b.y - b.gateT * (b.h.y * 2 + 0.05)
    if (Math.abs(b.c.y - y) > 1e-6) { b.c.y = y; boxAabb(b) }
  }
}

function stepPlates(W) {
  for (const b of W.boxes) {
    if (!b.plate) continue
    let m = 0
    for (const o of W.balls) if (o.ground && o.gBox === b) m += stackR(W, o) ** 3
    if (W.p.ground && !W.p.gBall && W.p.gBox === b) m += 0.08
    b.plateLoad = m
    const need = b.plate ** 3
    const was = !!b.pressed
    b.pressed = m >= need
    if (b.pressed !== was) W.events.push({ k: b.pressed ? 'plateOn' : 'plateOff', id: b.id })
    for (const g of W.boxes) if (g.gate && g.gate === b.id) g.gateOpen = b.pressed
  }
}

// 人の球を世界から押し出す。地面に立っているか、壁に当たったかを返す
function resolvePlayerBoxes(W, p) {
  let ground = null, wall = null
  for (let it = 0; it < 3; it++) {
    let moved = false
    for (const off of [K.feetY, K.bodyY]) {
      const c = v3(p.pos.x, p.pos.y + off, p.pos.z)
      for (const b of W.boxes) {
        const h = sphereBox(c, K.pr, b)
        if (!h) continue
        // 胴の球は下からの面に立たない（段差の角で引っかかって浮くのを防ぐ）
        let n = h.n
        if (off === K.bodyY && n.y > 0.3) continue
        if (off === K.feetY && n.y > 0.62) { ground = h; }
        else if (Math.abs(n.y) < 0.62) {
          wall = h
          // 足の球が段の角に当たった時は、横にだけ押す（小さい段は球が乗り越える）
        }
        add(p.pos, n, h.d); c.x = p.pos.x; c.y = p.pos.y + off; c.z = p.pos.z
        const vn = dot(p.vel, n); if (vn < 0) add(p.vel, n, -vn)
        moved = true
      }
    }
    if (!moved) break
  }
  return { ground, wall }
}

function stepPlayer(W, inp) {
  const p = W.p
  p.stun = Math.max(0, p.stun - DT)
  let mx = inp.mx || 0, mz = inp.mz || 0
  const ml = Math.hypot(mx, mz)
  if (ml > 1) { mx /= ml; mz /= ml }
  if (p.stun > 0) { mx *= 0.15; mz *= 0.15 }
  const moving = Math.hypot(mx, mz) > 0.15
  if (moving && !p.mantle) {
    const ty = Math.atan2(mx, mz)
    let d = ty - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d))
    p.yaw += d * Math.min(1, DT * (p.ground ? 14 : 6))
  }

  // よじ登りの途中
  if (p.mantle) {
    const m = p.mantle; m.t += DT
    const k = Math.min(1, m.t / K.mantleT)
    // 前半で上がり、後半で前へ
    const ku = Math.min(1, k / 0.6), kf = Math.max(0, (k - 0.45) / 0.55)
    const e = x => x * x * (3 - 2 * x)
    p.pos.x = m.from.x + (m.to.x - m.from.x) * e(kf)
    p.pos.z = m.from.z + (m.to.z - m.from.z) * e(kf)
    p.pos.y = m.from.y + (m.to.y - m.from.y) * e(ku)
    p.vel = v3()
    if (k >= 1) { p.mantle = null; p.ground = true; p.fallFrom = p.pos.y; W.events.push({ k: 'mantled' }) }
    carryHeld(W)
    return
  }

  // 足元の状態
  const ice = p.ground && p.gmat === 'ice'
  p.deep = p.ground && !p.gBall && !!zoneAt(W, 'deep', p.pos)
  const holding = !!p.hold
  let speed = p.deep ? K.deep : holding ? K.carry : K.walk
  const acc = !p.ground ? K.accAir : ice ? K.accIce : K.accG
  // 玉乗り: 乗っている雪玉を足で回す
  if (p.gBall && p.ground) {
    const base = baseOf(p.gBall)
    if (!base.held) {
      const s = pushShare(stackR(W, base)) * 0.8 + 0.2
      base.vel.x += mx * 7.5 * s * DT; base.vel.z += mz * 7.5 * s * DT
      const bs = Math.hypot(base.vel.x, base.vel.z); if (bs > 4.2) { base.vel.x *= 4.2 / bs; base.vel.z *= 4.2 / bs }
      // 人は玉のてっぺんに引き寄せる（乗ったまま運ばれる）
      const top = p.gBall.pos
      const tx = base.vel.x + (top.x - p.pos.x) * 5 + mx * 0.9, tz = base.vel.z + (top.z - p.pos.z) * 5 + mz * 0.9
      p.vel.x += (tx - p.vel.x) * Math.min(1, DT * 18); p.vel.z += (tz - p.vel.z) * Math.min(1, DT * 18)
    }
  } else {
    const tx = mx * speed, tz = mz * speed
    const dx = tx - p.vel.x, dz = tz - p.vel.z, dl = Math.hypot(dx, dz), mv = acc * DT
    if (dl <= mv) { p.vel.x = tx; p.vel.z = tz } else { p.vel.x += dx / dl * mv; p.vel.z += dz / dl * mv }
  }
  // 吹雪は人も少し押す
  const wz = zoneAt(W, 'wind', p.pos)
  if (wz) { p.vel.x += wz.fx * 0.18 * DT; p.vel.z += wz.fz * 0.18 * DT }

  // 跳ぶ
  if (inp.jump) p.jumpBuf = K.buffer; else p.jumpBuf = Math.max(0, p.jumpBuf - DT)
  p.coyote = p.ground ? K.coyote : Math.max(0, p.coyote - DT)
  if (p.jumpBuf > 0 && p.coyote > 0 && p.stun <= 0) {
    p.vel.y = K.jumpV * (p.deep ? 0.6 : 1); p.jumpBuf = 0; p.coyote = 0; p.ground = false
    if (p.gBall) { // 玉から跳ぶと玉は少し押し返される
      const base = baseOf(p.gBall); base.vel.x -= p.vel.x * 0.15 * pushShare(base.r); base.vel.z -= p.vel.z * 0.15 * pushShare(base.r)
    }
    p.gBall = null
    W.events.push({ k: 'jump' })
  } else if (!inp.jumpHeld && p.vel.y > 2.5) p.vel.y -= G * 1.2 * DT // 早く離すと低く

  // 重力（立っている時は面に押しつけるだけで、坂ですべらない。氷はすべる）
  if (p.ground && !ice && p.vel.y <= 0.01) { add(p.vel, p.gn, -G * DT * 0.5) }
  else p.vel.y -= G * DT
  if (p.vel.y < -40) p.vel.y = -40

  const prevY = p.pos.y
  add(p.pos, p.vel, DT)
  const { ground, wall } = resolvePlayerBoxes(W, p)
  // 雪玉と人
  let gBall = null; p.push = null
  for (const b of W.balls) {
    if (b === p.hold) continue
    for (const off of [K.feetY, K.bodyY]) {
      const c = v3(p.pos.x, p.pos.y + off, p.pos.z)
      const dx = c.x - b.pos.x, dy = c.y - b.pos.y, dz = c.z - b.pos.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz), rr = K.pr + b.r
      if (dist >= rr || dist < 1e-6) continue
      const n = v3(dx / dist, dy / dist, dz / dist), depth = rr - dist
      if (off === K.feetY && n.y > 0.55) {
        // 雪玉の上に立つ
        gBall = b
        add(p.pos, n, depth)
        const vn = dot(p.vel, n); if (vn < 0) add(p.vel, n, -vn)
        if (p.vel.y < b.vel.y) p.vel.y = b.vel.y
        continue
      }
      if (n.y > 0.55) { add(p.pos, n, depth); continue }
      // 横から押す
      const base = baseOf(b)
      const hn = Math.hypot(n.x, n.z) || 1
      const ux = -n.x / hn, uz = -n.z / hn // 人 → 玉 の向き
      const R = stackR(W, base)
      const s = base.held ? 0 : pushShare(R), pw = base.held ? 0 : pushPow(R)
      base.pos.x += ux * depth * s; base.pos.z += uz * depth * s
      p.pos.x -= ux * depth * (1 - s); p.pos.z -= uz * depth * (1 - s)
      const along = Math.max(0, mx * ux + mz * uz)
      let vb = base.vel.x * ux + base.vel.z * uz
      // 押す: 玉の速さを「歩く速さ × 大きさで決まる力」へ近づける
      const want = K.walk * pw * along
      if (vb < want && pw > 0) { const dv = Math.min(want - vb, 15 * pw * DT); base.vel.x += ux * dv; base.vel.z += uz * dv; vb += dv }
      // 人は玉より速くは進めない
      const vp = p.vel.x * ux + p.vel.z * uz
      if (vp > vb) { const k = vp - Math.max(0, vb); p.vel.x -= ux * k; p.vel.z -= uz * k }
      // 転がってきた玉に押される
      if (vb < -1.5) { const k = (-vb - 1.5) * (1 - s * 0.5); p.vel.x -= ux * k; p.vel.z -= uz * k; if (-vb > 4 && base.r > 0.7) { p.stun = Math.max(p.stun, 0.5); W.events.push({ k: 'bump' }) } }
      if (s > 0 && moving && (mx * ux + mz * uz) > 0.3) p.push = { r: stackR(W, base), b: base }
      else if (s === 0 && moving && (mx * ux + mz * uz) > 0.3) p.push = { r: stackR(W, base), b: base, stuck: true }
    }
  }
  if (p.push) { const bs = Math.hypot(p.push.b.vel.x, p.push.b.vel.z); p.pushT = bs < 0.35 ? p.pushT + DT : 0 } else p.pushT = 0
  p.wallN = wall ? wall.n : null
  const wasGround = p.ground
  p.ground = !!(ground || gBall)
  p.gBall = gBall
  if (ground) { p.gn = ground.n; p.gmat = ground.b.mat; p.gBox = ground.b }
  else if (gBall) { p.gn = v3(0, 1, 0); p.gmat = 'ball'; p.gBox = null }
  if (p.ground) {
    if (!wasGround) {
      const h = p.fallFrom - p.pos.y
      W.events.push({ k: 'land', h, ball: !!gBall })
      if (h > 6) { p.stun = Math.min(1.2, 0.3 + h * 0.05); W.events.push({ k: 'bigfall', h }) }
    }
    p.fallFrom = p.pos.y; p.airT = 0
  } else {
    p.airT += DT
    if (p.pos.y > p.fallFrom) p.fallFrom = p.pos.y
  }

  // 手を掛ける（壁に向かって進もうとしている時）
  if (moving && !p.hold) tryMantle(W, p, mx, mz)

  // つかむ・置く
  if (inp.grab) grabOrPlace(W)
  if (inp.make) makeHere(W)
  carryHeld(W)
}

// 前に段の上面があり、手が届けばよじ登る
function tryMantle(W, p, mx, mz) {
  const ml = Math.hypot(mx, mz); if (ml < 0.3) return
  const fx = mx / ml, fz = mz / ml
  // 雪玉によじ登る: 跳んでいる時か、押しても動かない時だけ（歩いて押す時は押す）
  if (!p.ground || (p.push && (p.push.stuck || p.pushT > 0.35))) {
    let bb = null
    for (const b of W.balls) {
      if (b.held || W.balls.some(o => o.on === b)) continue
      const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z, dh = Math.hypot(dx, dz)
      if (dh > b.r + 0.75 || dh < 0.05) continue
      if ((dx * fx + dz * fz) / dh < 0.5) continue
      const top = b.pos.y + b.r
      if (top < p.pos.y + 0.42 || top > p.pos.y + (p.ground ? K.reachStand : K.reachAir)) continue
      if (!bb || top > bb.top) bb = { b, top }
    }
    if (bb && !(!p.ground && p.vel.y > 3.5)) {
      p.mantle = { t: 0, from: v3(p.pos.x, p.pos.y, p.pos.z), to: v3(bb.b.pos.x, bb.top + 0.02, bb.b.pos.z), ball: bb.b }
      W.events.push({ k: 'grabLedge', h: bb.top - p.pos.y, ball: true })
      return
    }
  }
  // 壁に当たっている時だけ（何もない所で空中に引っかからない）
  if (!p.wallN || (p.wallN.x * fx + p.wallN.z * fz) > -0.45) return
  const reach = p.ground ? K.reachStand : K.reachAir
  if (!p.ground && p.vel.y > 3.5) return // 上がっている最中は頂点まで待つ（高く届く）
  const top = p.pos.y + reach
  let best = null
  for (const ahead of [0.62, 0.82]) {
    const o = v3(p.pos.x + fx * ahead, top + 0.02, p.pos.z + fz * ahead)
    for (const b of W.boxes) {
      if (b.noGrab) continue
      const h = rayBox(o, v3(0, -1, 0), b, reach + 0.1)
      if (!h || h.n.y < 0.75) continue
      const y = o.y - h.t
      if (y < p.pos.y + 0.42) continue // 低い段は歩いて上がる
      if (!best || y > best.y) best = { y, ahead }
    }
    if (best) break
  }
  if (!best) return
  // 上に体が入る隙間があるか
  const to = v3(p.pos.x + fx * (best.ahead + 0.25), best.y + 0.02, p.pos.z + fz * (best.ahead + 0.25))
  for (const off of [K.feetY + 0.05, K.bodyY, K.bodyY + 0.4]) {
    const c = v3(to.x, to.y + off, to.z)
    for (const b of W.boxes) { const h = sphereBox(c, K.pr * 0.9, b); if (h && h.d > 0.04) return }
  }
  p.mantle = { t: 0, from: v3(p.pos.x, p.pos.y, p.pos.z), to }
  p.gBall = null
  W.events.push({ k: 'grabLedge', h: best.y - p.pos.y })
}

function carryHeld(W) {
  const p = W.p, b = p.hold; if (!b) return
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw)
  b.pos.x = p.pos.x + fx * (0.42 + b.r * 0.7); b.pos.z = p.pos.z + fz * (0.42 + b.r * 0.7); b.pos.y = p.pos.y + 1.15 + b.r * 0.35
  b.vel = v3(p.vel.x, p.vel.y, p.vel.z); b.ground = false
}

// 置く先: 前にある自分より大きい雪玉のてっぺん（重ねる）か、足元の前
export function placeTarget(W) {
  const p = W.p, h = p.hold; if (!h) return null
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw)
  let best = null
  for (const b of W.balls) {
    if (b === h || b.held) continue
    // 一番上の雪玉にしか乗せられない
    if (W.balls.some(o => o.on === b)) continue
    if (b.r < h.r * 0.95) continue
    const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z, dh = Math.hypot(dx, dz)
    if (dh > b.r + 1.25) continue
    if ((dx * fx + dz * fz) / (dh || 1) < 0.35) continue
    // 背が届くか（てっぺんが頭より高すぎない）
    const topY = b.pos.y + b.r
    if (topY > p.pos.y + 2.6) continue
    if (!best || dh < best.dh) best = { b, dh }
  }
  if (best) return { kind: 'stack', on: best.b }
  return { kind: 'drop', x: p.pos.x + fx * (0.5 + h.r), z: p.pos.z + fz * (0.5 + h.r) }
}

function grabOrPlace(W) {
  const p = W.p
  if (p.hold) {
    const h = p.hold, t = placeTarget(W)
    h.held = false; p.hold = null
    if (t.kind === 'stack') {
      h.on = t.on; followStack(h)
      W.events.push({ k: 'stack', id: h.id, on: t.on.id })
    } else {
      h.pos.x = t.x; h.pos.z = t.z; h.pos.y = p.pos.y + h.r + 0.25; h.vel = v3(p.vel.x * 0.3, 0, p.vel.z * 0.3)
      // 壁にめり込んだら手前へ
      for (const b of W.boxes) { const c = sphereBox(h.pos, h.r, b); if (c && c.n.y < 0.5) add(h.pos, c.n, c.d) }
      W.events.push({ k: 'drop', id: h.id })
    }
    return
  }
  // つかむ: 前にある小さい雪玉（重なりの一番上を優先）
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw)
  let best = null
  for (const b of W.balls) {
    if (b.r > K.rGrab) continue
    if (W.balls.some(o => o.on === b)) continue // 上に何か乗っている
    if (b === p.gBall) continue
    const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z, dy = b.pos.y - (p.pos.y + 0.9), dh = Math.hypot(dx, dz)
    if (dh > b.r + 1.0 || Math.abs(dy) > 1.6) continue
    if ((dx * fx + dz * fz) / (dh || 1) < 0.2) continue
    if (!best || dh < best.dh) best = { b, dh }
  }
  if (best) {
    const b = best.b; b.on = null; b.held = true; p.hold = b
    W.events.push({ k: 'grab', id: b.id })
  } else {
    // 持てない大きさの玉が前にある
    for (const b of W.balls) {
      const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z, dh = Math.hypot(dx, dz)
      if (dh < b.r + 1.0 && (dx * fx + dz * fz) / (dh || 1) > 0.3 && b.r > K.rGrab) { W.events.push({ k: 'tooHeavy', id: b.id }); return }
    }
    W.events.push({ k: 'grabNone' })
  }
}

function makeHere(W) {
  const p = W.p
  if (p.hold || !p.ground || p.gBall) { W.events.push({ k: 'makeNo', why: 'busy' }); return }
  if (p.gmat !== 'snow') { W.events.push({ k: 'makeNo', why: p.gmat }); return }
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), r = 0.3
  const pos = v3(p.pos.x + fx * 0.85, p.pos.y + r + 0.02, p.pos.z + fz * 0.85)
  for (const b of W.boxes) { const c = sphereBox(pos, r, b); if (c && c.n.y < 0.5 && c.d > 0.05) { W.events.push({ k: 'makeNo', why: 'wall' }); return } }
  for (const o of W.balls) { const dx = o.pos.x - pos.x, dy = o.pos.y - pos.y, dz = o.pos.z - pos.z; if (dx * dx + dy * dy + dz * dz < (o.r + r) ** 2) { W.events.push({ k: 'makeNo', why: 'ball' }); return } }
  makeBall(W, pos.x, pos.y, pos.z, r)
}

function followStack(b) {
  const o = b.on
  b.pos.x = o.pos.x; b.pos.z = o.pos.z; b.pos.y = o.pos.y + o.r + b.r * 0.86
  b.vel = v3(o.vel.x, o.vel.y, o.vel.z); b.ground = false
}

function stepBall(W, b) {
  if (b.held || b.on) return
  const r = b.r
  // 地面の力（前の刻みの面）
  if (b.ground) {
    const n = b.gn
    const ice = b.gmat === 'ice'
    const gdn = -G * n.y // 重力の面に沿う成分 = g - n(g·n)
    const gT = v3(-gdn * n.x, -G - gdn * n.y, -gdn * n.z)
    const roll = ice ? 1 : 5 / 7
    const mu = ice ? 0.012 : (b.gmat === 'rock' ? 0.05 : 0.02) + 0.115 / r
    const vnm = dot(b.vel, n)
    const vt = v3(b.vel.x - n.x * vnm, b.vel.y - n.y * vnm, b.vel.z - n.z * vnm)
    const sp = len(vt), gA = len(gT) * roll, res = mu * G * n.y
    if (sp < 0.06 && gA <= res) { vt.x = vt.y = vt.z = 0 }
    else {
      add(vt, gT, roll * DT)
      const s2 = len(vt)
      if (s2 > 1e-6) { const k = Math.max(0, s2 - res * DT) / s2; vt.x *= k; vt.y *= k; vt.z *= k }
    }
    b.vel = v3(vt.x - n.x * 0.6 * DT * G, vt.y - n.y * 0.6 * DT * G, vt.z - n.z * 0.6 * DT * G)
  } else {
    b.vel.y -= G * DT
  }
  // 吹雪（小さい玉ほど流される）
  const wz = zoneAt(W, 'wind', b.pos)
  if (wz) { const k = 0.55 / Math.max(0.3, r); b.vel.x += wz.fx * k * DT; b.vel.z += wz.fz * k * DT }
  const sp0 = Math.hypot(b.vel.x, b.vel.y, b.vel.z)
  if (sp0 > 30) { const k = 30 / sp0; b.vel.x *= k; b.vel.y *= k; b.vel.z *= k }

  const px = b.pos.x, pz = b.pos.z
  add(b.pos, b.vel, DT)
  // 箱
  let g = null
  for (let it = 0; it < 3; it++) {
    let moved = false
    for (const bx of W.boxes) {
      const h = sphereBox(b.pos, b.r, bx)
      if (!h) continue
      const vn = dot(b.vel, h.n)
      // 氷の壁: 速く重い玉で割れる
      if (bx.breakable && vn < 0) {
        const imp = -vn * b.r ** 3
        if (imp >= bx.breakable) {
          bx.on = false; W.events.push({ k: 'break', id: bx.id, x: bx.c.x, y: bx.c.y, z: bx.c.z, imp })
          b.vel.x *= 0.55; b.vel.z *= 0.55
          continue
        } else if (-vn > 1.2 && W.t - b.lastHit > 0.3) { W.events.push({ k: 'thud', id: b.id, imp }); b.lastHit = W.t }
      }
      add(b.pos, h.n, h.d)
      if (vn < 0) {
        const bounce = -vn > 7 ? 0.18 : 0
        add(b.vel, h.n, -vn * (1 + bounce))
        if (-vn > 3 && W.t - b.lastHit > 0.25) { W.events.push({ k: 'thud', id: b.id, imp: -vn * b.r ** 3, x: b.pos.x, y: b.pos.y, z: b.pos.z }); b.lastHit = W.t }
      }
      if (h.n.y > 0.45 && (!g || h.n.y > g.n.y)) g = h
      moved = true
    }
    if (!moved) break
  }
  b.ground = !!g
  if (g) { b.gn = g.n; b.gmat = g.b.mat; b.gBox = g.b } else b.gBox = null
  // 転がった距離 → 太る / 日なた → 溶ける
  const dx = b.pos.x - px, dz = b.pos.z - pz, dist = Math.hypot(dx, dz)
  b.sun = !!zoneAt(W, 'sun', b.pos)
  if (g && dist > 1e-5) {
    // 見た目の回転
    const ax = dz / dist, az = -dx / dist, ang = dist / b.r
    qmul(b.spin, ax, 0, az, ang)
    if (b.gmat === 'snow' && !b.sun) {
      const deepK = zoneAt(W, 'deep', b.pos) ? 1.7 : 1
      const nr = Math.min(K.rMax, Math.sqrt(b.r * b.r + K.grow * dist * deepK))
      if (nr > b.r) { b.pos.x += b.gn.x * (nr - b.r); b.pos.y += b.gn.y * (nr - b.r); b.pos.z += b.gn.z * (nr - b.r); b.r = nr }
      b.rolled += dist
    }
  }
  if (b.sun) {
    b.r -= K.melt * DT
    if (b.ground) b.pos.y -= K.melt * DT
    if (b.r < 0.16) removeBall(W, b, 'melt')
  }
}

function qmul(q, ax, ay, az, ang) {
  const s = Math.sin(ang / 2), c = Math.cos(ang / 2)
  const bx = ax * s, by = ay * s, bz = az * s, bw = c
  const x = bw * q.x + bx * q.w + by * q.z - bz * q.y
  const y = bw * q.y - bx * q.z + by * q.w + bz * q.x
  const z = bw * q.z + bx * q.y - by * q.x + bz * q.w
  const w = bw * q.w - bx * q.x - by * q.y - bz * q.z
  const l = Math.hypot(x, y, z, w); q.x = x / l; q.y = y / l; q.z = z / l; q.w = w / l
}

function ballPairs(W) {
  const B = W.balls
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], b = B[j]
    if (a.held || b.held) continue
    const ba = baseOf(a), bb = baseOf(b)
    if (ba === bb) continue
    const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y, dz = b.pos.z - a.pos.z
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz), rr = a.r + b.r
    if (d >= rr || d < 1e-6) continue
    const n = v3(dx / d, dy / d, dz / d), depth = rr - d
    const ma = stackR(W, ba) ** 3, mb = stackR(W, bb) ** 3
    // 動けるのは重なりの一番下だけ
    const ka = mb / (ma + mb), kb = ma / (ma + mb)
    add(ba.pos, n, -depth * ka); add(bb.pos, n, depth * kb)
    const rv = (bb.vel.x - ba.vel.x) * n.x + (bb.vel.y - ba.vel.y) * n.y + (bb.vel.z - ba.vel.z) * n.z
    if (rv < 0) {
      const jj = -rv * 1.1
      add(ba.vel, n, -jj * ka); add(bb.vel, n, jj * kb)
      if (-rv > 2 && W.t - a.lastHit > 0.25) { W.events.push({ k: 'thud', id: a.id, imp: -rv, x: a.pos.x, y: a.pos.y, z: a.pos.z }); a.lastHit = W.t }
    }
    // 上から乗った小さい玉は、くっついて重なる（雪だるま）
    if (Math.abs(n.y) > 0.8 && !a.on && !b.on) {
      const up = n.y > 0 ? b : a, dn = n.y > 0 ? a : b
      if (up.r <= dn.r * 1.02 && !W.balls.some(o => o.on === dn)) { up.on = dn; W.events.push({ k: 'stack', id: up.id, on: dn.id }) }
    }
  }
}

// 検査用: 世界の状態を数字で
export function snapshot(W) {
  const p = W.p
  return {
    t: +W.t.toFixed(3), flag: W.flag,
    p: { x: +p.pos.x.toFixed(3), y: +p.pos.y.toFixed(3), z: +p.pos.z.toFixed(3), ground: p.ground, mantle: !!p.mantle, hold: p.hold ? p.hold.id : 0, onBall: p.gBall ? p.gBall.id : 0 },
    balls: W.balls.map(b => ({ id: b.id, x: +b.pos.x.toFixed(3), y: +b.pos.y.toFixed(3), z: +b.pos.z.toFixed(3), r: +b.r.toFixed(3), on: b.on ? b.on.id : 0, held: b.held, ground: b.ground, mat: b.gmat })),
  }
}
