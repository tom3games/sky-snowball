// 山のコース。全部「箱」で作る（見た目と当たりが同じデータ）。
// 座標: x 左右、y 上、z 奥（登る向き）。区間は z が進むほど高くなり、段から落ちると前の区間の床に落ちる。
// mat: snow（雪玉が太る）/ rock（太らない）/ ice（すべる・太らない）
const B = []
const zones = []
const flags = []
const sections = []
const hints = []
const lamps = []
function lamp(x, y, z) { lamps.push({ x, y, z }) }
let id = 0
const BASE = -24

function box(o) { o.id = ++id; B.push(o); return o }
// 上面の高さ top の床（下は BASE まで埋まった塊）
function slab(x0, x1, z0, z1, top, mat = 'snow', o = {}) {
  const bot = o.bot ?? BASE
  return box({ x: (x0 + x1) / 2, y: (top + bot) / 2, z: (z0 + z1) / 2, w: x1 - x0, h: top - bot, d: z1 - z0, mat, ...o })
}
// 坂: z0 で y0、z1 で y1 の面（厚み th の板を傾けたもの）
function ramp(x0, x1, z0, z1, y0, y1, mat = 'snow', th = 3, o = {}) {
  const dz = z1 - z0, dy = y1 - y0, a = Math.atan2(dy, dz), L = Math.hypot(dz, dy)
  const nx = 0, ny = Math.cos(a), nz = -Math.sin(a)
  return box({ x: (x0 + x1) / 2 - nx * th / 2, y: (y0 + y1) / 2 - ny * th / 2, z: (z0 + z1) / 2 - nz * th / 2, w: x1 - x0, h: th, d: L, pitch: -a, mat, ...o })
}
// 横に傾いた床（左が高い）。roll は度
function tilted(x0, x1, z0, z1, ymid, deg, mat = 'ice', th = 2, o = {}) {
  const a = deg * Math.PI / 180
  return box({ x: (x0 + x1) / 2 - Math.sin(a) * th / 2, y: ymid - Math.cos(a) * th / 2, z: (z0 + z1) / 2, w: (x1 - x0) / Math.cos(a), h: th, d: z1 - z0, roll: -a, mat, ...o })
}
function sec(name, z, y, why, extra = {}) { sections.push({ i: sections.length, name, z, y, why, ...extra }) }
function flag(x, y, z, yaw = 0) { flags.push({ x, y, z, yaw }) }
function hint(x0, x1, z0, z1, y, key) { hints.push({ x0, x1, z0, z1, y0: y - 1, y1: y + 6, key }) }

// ===== 0. ふもと =====
sec('ふもと', -8, 0, '3m の段は跳んでも届かない。雪玉に乗れば手が届く', { en: 'Foothill' })
flag(0, 0, -1)
slab(-9, 9, -8, 10, 0)
slab(-14, -9, -11, 24, 11, 'rock'); slab(9, 12, -11, 10, 0.9, 'rock'); slab(9, 12, 10, 22, 2.3, 'rock'); slab(-12, 12, -11, -8, 7, 'rock')
slab(-9, 9, 10, 22, 1.8)                // 跳べば登れる段
slab(-9, 9, 22, 30, 4.8)                // 跳んでも届かない段（3.0m）
lamp(-7.5, 1.8, 11); lamp(6, 4.8, 23); lamp(-3.2, 1.8, 21.4); hint(-9, 9, -8, 6, 0, 'h_move'); hint(-9, 9, 6, 10, 0, 'h_climb'); hint(-9, 9, 10, 22, 1.8, 'h_make')

// ===== 1. くぼみの坂 =====
sec('くぼみの坂', 22, 4.8, '16度の坂は、大きい雪玉を置くと勝手に転がり落ちる。押し続けて、坂の上のくぼみで止める', { en: 'The Hollow' })
flag(-3, 4.8, 25)
slab(-9, -7, 22, 30, 9, 'rock'); slab(-9, -6, 30, 46, 15, 'rock')
const sl = Math.tan(16 * Math.PI / 180)
const yTop1 = 4.8 + 14.5 * sl
ramp(-6, 6, 30, 44.5, 4.8, yTop1)
slab(-6, 6, 44.5, 46, yTop1)            // くぼみ（奥行き 1.5m）
slab(7, 13, 30, 47, 2.8)                // 右へ落ちた時に受け止める棚（そこから段へ戻れる）
slab(13, 15, 30, 47, 3.8, 'rock')
hint(-6, 6, 30, 38, 4.8, 'h_slope')

// ===== 2. 岩場と穴 =====
const y2 = +(yTop1 + 3.65).toFixed(2)
sec('岩場と穴', 46, y2, '穴は跳び越せない。太らせた雪玉を落として足場にする。ただし岩場では太らず、岩の間は大きすぎると通らない', { en: 'Rock Gap' })
flag(0, y2, 48)
slab(-8, 8, 46, 58, y2)
slab(-10, -8, 46, 60, y2 + 5, 'rock'); slab(8, 10, 46, 60, y2 + 1.0, 'rock')
slab(-3, 3, 58, 70, y2, 'rock')         // 岩場（太らない）
slab(-8, -3, 58, 82, y2 + 4.5, 'rock'); slab(3, 8, 58, 66, y2 + 1.2, 'rock'); slab(3, 8, 66, 77.5, y2 + 4.5, 'rock'); slab(3, 8, 77.5, 82, y2 + 1.2, 'rock')
slab(-3, -1.12, 63, 65.5, y2 + 3, 'rock'); slab(1.12, 3, 63, 65.5, y2 + 3, 'rock') // 岩の間 2.24m
const pitY = y2 - 3.9
slab(-3, 3, 70, 73.4, pitY)             // 穴の底
slab(1.9, 3, 70, 70.75, pitY + 1.85, 'rock') // 底から戻る足掛かり
slab(-3, 3, 73.4, 82, y2, 'rock')
lamp(-6, y2, 47); lamp(2.5, y2, 74.5); lamp(-2.5, y2, 74.5); hint(-8, 8, 46, 56, y2, 'h_grow'); hint(-3, 3, 66, 70, y2, 'h_pit')

// ===== 3. 雪だるま =====
const y3 = y2
sec('雪だるま', 82, y3, '1つの雪玉では押せる大きさに限りがあり、届かない。小さい雪玉を持ち上げて重ね、岩棚から跳び移る', { en: 'Snowman' })
flag(-2, y3, 84)
slab(-9, 9, 82, 98, y3)
slab(-12, -9, 80, 100, y3 + 8, 'rock'); slab(9, 12, 80, 100, y3 + 1.0, 'rock')
slab(5.2, 9, 91, 98, y3 + 2.0, 'rock')  // 岩棚（跳べば上がれる）
const y4 = y3 + 5.0
slab(-9, 9, 98, 108, y4)                // 4.9〜5.0m の崖
lamp(7.5, y3 + 2, 92); lamp(-6, y4, 99); hint(-9, 9, 84, 96, y3, 'h_stack')

// ===== 4. 日なた =====
sec('湯けむりの岩棚', 98, y4, '岩の割れ目から吹く湯気で雪玉が溶けて縮む。湯気が止んだ隙に運ぶ', { en: 'Steam Vents' })
flag(-4, y4, 101)
slab(-12, -9, 96, 128, y4 + 8, 'rock'); slab(9, 12, 96, 108, y4 + 1.0, 'rock')
slab(-9, 3, 108, 126, y4)               // 日なたの道
slab(3, 5, 108, 126, y4 + 0.5, 'rock', { noGrab: true }) // 縁石
const y5 = y4 + 3.6
slab(-9, 5, 126, 134, y5)
zones.push({ kind: 'sun', x0: -9, x1: 5, z0: 108, z1: 116, y0: y4 - 1, y1: y4 + 6, period: 12, on: 6, phase: 0, id: 'sun4' })
zones.push({ kind: 'sun', x0: -9, x1: 5, z0: 119.5, z1: 126, y0: y4 - 1, y1: y4 + 6, period: 12, on: 6, phase: 0, id: 'sun4b' })
slab(-9, -1.5, 116, 119.5, y4 + 4.6, 'rock', { bot: y4 + 3.4, noGrab: true }) // 岩の庇（下は湯気が来ない）
slab(-12, -9, 115, 120.5, y4 + 4.6, 'rock', { bot: y4 })
lamp(-6, y5, 127); hint(-9, 3, 104, 110, y4, 'h_sun')

// ===== 5. 氷の床 =====
sec('氷の床', 126, y5, '氷の上では雪玉がすべって谷へ落ちる。岩の縁に沿わせて運ぶ', { en: 'Ice Shelf' })
flag(-3, y5, 128)
slab(-12, -9, 126, 150, y5 + 8, 'rock')
tilted(-9, 5, 134, 150, y5, 7, 'ice')
slab(-2.4, -2.0, 135, 150, y5 + 0.55, 'rock', { noGrab: true }) // 縁石
const y6 = y5 + 3.7
slab(-9, 5, 150, 156, y6)
lamp(-7, y6, 151); hint(-9, 5, 132, 138, y5, 'h_ice')

// ===== 6. 吹雪の尾根 =====
sec('吹雪の尾根', 150, y6, '吹雪が雪玉を谷へ流す。岩陰で待ち、止んだら運ぶ', { en: 'Blizzard Ridge' })
flag(-4, y6, 152)
slab(-12, -9, 150, 178, y6 + 8, 'rock')
slab(-9, 0, 156, 176, y6)
slab(-9, -5, 160, 161.6, y6 + 2.6, 'rock'); slab(-9, -5, 167, 168.6, y6 + 2.6, 'rock') // 風よけの岩
zones.push({ kind: 'wind', x0: -9, x1: 1, z0: 156, z1: 176, y0: y6 - 1, y1: y6 + 8, fx: 9, fz: 0, period: 8, on: 3.5, phase: 2, id: 'wind6' })
const y7 = y6 + 4.0
slab(-9, 0, 176, 182, y7)
lamp(-7.5, y6, 162); lamp(-7.5, y6, 169); lamp(-7, y7, 177); hint(-9, 0, 154, 160, y6, 'h_wind')

// ===== 7. 深い新雪 =====
sec('深い新雪', 176, y7, '人は腰まで埋まって進めない。雪玉に乗って転がす。ただし太りすぎると門を通らない', { en: 'Deep Powder' })
flag(-4, y7, 178)
slab(-12, -9, 176, 214, y7 + 8, 'rock'); slab(0, 3, 176, 214, y7 + 1.4, 'rock')
const dTop = y7, dBot = y7 - 26 * Math.tan(4 * Math.PI / 180)
ramp(-9, 0, 182, 208, dTop, dBot)
zones.push({ kind: 'deep', x0: -9, x1: 0, z0: 182.5, z1: 208, y0: dBot - 2, y1: dTop + 3, id: 'deep7' })
slab(-6.5, -4.5, 192, 194, dTop + 0.0, 'rock', { noGrab: true, bot: dBot - 4 })
slab(-9, 0, 208, 216, dBot, 'rock')
slab(-9, -5.7, 210, 212, dBot + 5, 'rock'); slab(-3.3, 0, 210, 212, dBot + 5, 'rock') // 門 2.4m
const y9 = dBot + 3.5
lamp(-5.5, dBot + 5, 209.5); lamp(-3.5, dBot + 5, 209.5); hint(-9, 0, 182, 188, y7, 'h_ride')

// ===== 8. 氷の壁 =====
sec('氷の壁', 216, y9, '氷の壁は人では壊せない。高い所で育てた重い雪玉を坂で走らせてぶつける', { en: 'Ice Wall' })
flag(2, y9, 218)
slab(-12, -9, 214, 244, y9 + 9, 'rock'); slab(6, 9, 214, 244, y9 + 1.2, 'rock')
slab(-9, 6, 216, 244, y9, 'rock')                     // 床（岩。ここでは太らない）
slab(-9, -2.5, 216, 223, y9 + 2.0)                    // 高い雪の台（跳べば上がれる）
ramp(-9, -2.5, 223, 229.5, y9 + 2.0, y9, 'snow', 4)   // 壁へ下る坂
box({ x: -1.5, y: y9 + 3, z: 233, w: 15, h: 6, d: 1.2, mat: 'ice', breakable: 2.6, noGrab: true }) // 氷の壁（左右いっぱい）
const y10 = y9 + 3.7
lamp(-3, y9 + 2.0, 217.5); lamp(4.5, y9, 234.5); hint(-9, 6, 216, 222, y9, 'h_wall')

// ===== 9. 重りの門 =====
sec('重りの門', 244, y10, '門は重さでしか開かない。大きい雪玉を踏み板に置いたまま、もう1つ作って運ぶ', { en: 'Weighted Gate' })
slab(-9, 6, 244, 252, y9, 'rock')                     // 崖の下（壁を割った先）
flag(-3, y10, 254.5)
slab(-12, -9, 252, 280, y10 + 9, 'rock'); slab(6, 9, 252, 280, y10 + 1.2, 'rock')
slab(-9, 6, 252, 266, y10)                            // 雪原
box({ x: 3.5, y: y10 + 0.02, z: 259, w: 3, h: 0.3, d: 3, mat: 'rock', plate: 1.0, noGrab: true }) // 踏み板
box({ x: -1.5, y: y10 + 2.6, z: 266.6, w: 15, h: 5.2, d: 1.2, mat: 'rock', gate: 0, noGrab: true }) // 門
slab(-9, 6, 266, 272, y10, 'rock')
const ySum = y10 + 3.75
lamp(5, y10, 257); lamp(-8, y10 + 5.2, 267.5); hint(-9, 6, 252, 258, y10, 'h_gate')

// ===== 山頂 =====
sec('山頂', 272, ySum, '', { en: 'Summit' })
slab(-12, 9, 272, 290, ySum)
flag(-3, ySum, 278)

// ランタンの柱と旗竿（細い当たり。見た目は view/night が同じ位置に描く）
for (const L of lamps) box({ x: L.x, y: L.y + 0.95, z: L.z, w: 0.12, h: 1.9, d: 0.12, mat: 'rock', prop: true, noGrab: true })
for (const f of flags) {
  box({ x: f.x - 1.6, y: f.y + 0.95, z: f.z + 0.9, w: 0.12, h: 1.9, d: 0.12, mat: 'rock', prop: true, noGrab: true })
  box({ x: f.x + 1.4, y: f.y + 1.3, z: f.z + 0.9, w: 0.1, h: 2.6, d: 0.1, mat: 'rock', prop: true, noGrab: true })
}

// 門と踏み板をつなぐ
{ const pl = B.find(b => b.plate), gt = B.find(b => b.gate === 0); gt.gate = pl.id }

export const COURSE = {
  boxes: B, zones, flags, sections, hints, lamps, H: { yTop1, y2, pitY, y3, y4, y5, y6, y7, dBot, y9, y10, ySum },
  start: { x: 0, y: 0, z: -1, yaw: 0 },
  killY: -18,
  summit: { x: -3, y: ySum, z: 282 },
}
