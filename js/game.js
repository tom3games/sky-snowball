// SKY SNOWBALL 本体: 入力・カメラ・固定 60Hz の進行・画面の文字
import * as THREE from 'three'
import { createWorld, step, DT, K, respawn, placeTarget, rayBox, pushPow, zoneAt, zoneState, snapshot, makeBall, baseOf } from './phys.js?v=3'
import { COURSE } from './course.js?v=3'
import { buildView, View } from './view.js?v=3'
import { T, setLang, lang } from './text.js?v=3'

const $ = s => document.querySelector(s)
const store = { get(k, d) { try { const v = localStorage.getItem('sky-snowball:' + k); return v == null ? d : JSON.parse(v) } catch (e) { return d } }, set(k, v) { try { localStorage.setItem('sky-snowball:' + k, JSON.stringify(v)) } catch (e) {} } }

let W = createWorld(COURSE)
const view = buildView(W, $('#view'))
const cam = view.camState
const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
document.documentElement.classList.toggle('touch', touch)

// ---- 音 ----

Snd.def({
  jump: ['snd/swish.mp3'], land: ['snd/land1.mp3', 'snd/land2.mp3', 'snd/land3.mp3'],
  make: ['snd/pebbles.mp3'], flag: 'snd/save.mp3', thud: ['snd/rumble_a.mp3', 'snd/rumble_b.mp3'],
  grab: 'snd/cloth.mp3', step: ['snd/step1.mp3', 'snd/step2.mp3', 'snd/step3.mp3', 'snd/step4.mp3', 'snd/step5.mp3', 'snd/step6.mp3', 'snd/step7.mp3'], fall: ['snd/rumble_c.mp3'], crack: ['snd/crack1.mp3', 'snd/crack2.mp3'], finish: 'snd/finish.mp3',
})
let muted = store.get('mute', false); Snd.setMute(muted)

// ---- 入力 ----
const keys = new Set()
const edge = { jump: false, grab: false, make: false }
addEventListener('keydown', e => {
  if (e.repeat) return
  keys.add(e.code)
  if (e.code === 'Space') { edge.jump = true; e.preventDefault() }
  if (e.code === 'KeyE' || e.code === 'KeyF') edge.grab = true
  if (e.code === 'KeyQ' || e.code === 'KeyC') edge.make = true
  if (e.code === 'KeyR' && state === 'play') { respawn(W, 'manual'); falls++ }
  if (e.code === 'Escape' && state === 'play') pause(true)
})
addEventListener('keyup', e => keys.delete(e.code))
addEventListener('blur', () => keys.clear())

// 見回す（PC はマウスを押してなぞる、またはクリックで視点を固定）
let dragging = null
const canvas = view.renderer.domElement
canvas.addEventListener('mousedown', e => { if (state !== 'play') return; dragging = { x: e.clientX, y: e.clientY }; if (!touch && e.button === 0 && canvas.requestPointerLock) { try { canvas.requestPointerLock() } catch (er) {} } })
addEventListener('mouseup', () => { dragging = null })
addEventListener('mousemove', e => {
  if (state !== 'play') return
  if (document.pointerLockElement === canvas) { look(e.movementX, e.movementY, 0.0026); return }
  if (dragging) { look(e.clientX - dragging.x, e.clientY - dragging.y, 0.006); dragging.x = e.clientX; dragging.y = e.clientY }
})
function look(dx, dy, k) { cam.yaw -= dx * k; cam.pitch = Math.max(-0.25, Math.min(1.15, cam.pitch + dy * k)); cam.auto = 1.6 }

// スマホ: 左で歩く（指を置いた所が中心）、右をなぞって見回す、右下のボタン
const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 }
const lookT = { id: null, x: 0, y: 0 }
const pinch = { a: null, b: null, d: 0 }
const touches = new Map()
const stickEl = $('#stick'), knob = $('#knob')
// 左下に固定のスティック。中心はいつも同じ所
function stickCenter() { const r = stickEl.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width / 2 } }
function onTouchStart(e) {
  if (state !== 'play') return
  for (const t of e.changedTouches) {
    if (t.target.closest('.tbtn')) continue
    touches.set(t.identifier, { x: t.clientX, y: t.clientY })
    const c = stickCenter()
    if (stick.id === null && Math.hypot(t.clientX - c.x, t.clientY - c.y) < c.R * 1.6) {
      stick.id = t.identifier; stick.ox = c.x; stick.oy = c.y; moveStick(t.clientX, t.clientY); stickEl.classList.add('on')
    } else if (lookT.id === null) { lookT.id = t.identifier; lookT.x = t.clientX; lookT.y = t.clientY }
    else if (pinch.a === null) { pinch.a = lookT.id; pinch.b = t.identifier; const A = touches.get(pinch.a); pinch.d = Math.hypot(A.x - t.clientX, A.y - t.clientY) }
  }
  e.preventDefault()
}
function moveStick(x, y) {
  let dx = x - stick.ox, dy = y - stick.oy; const l = Math.hypot(dx, dy), R = stickCenter().R * 0.8
  if (l > R) { dx *= R / l; dy *= R / l }
  stick.x = dx / R; stick.y = dy / R
  knob.style.transform = `translate(${dx}px,${dy}px)`
}
function onTouchMove(e) {
  for (const t of e.changedTouches) {
    touches.set(t.identifier, { x: t.clientX, y: t.clientY })
    if (t.identifier === stick.id) moveStick(t.clientX, t.clientY)
    else if (pinch.a !== null && (t.identifier === pinch.a || t.identifier === pinch.b)) {
      const A = touches.get(pinch.a), B = touches.get(pinch.b); if (!A || !B) continue
      const d = Math.hypot(A.x - B.x, A.y - B.y); zoom((pinch.d - d) * 0.025); pinch.d = d
      lookT.x = touches.get(lookT.id)?.x ?? lookT.x; lookT.y = touches.get(lookT.id)?.y ?? lookT.y
    } else if (t.identifier === lookT.id) {
      look(t.clientX - lookT.x, t.clientY - lookT.y, 0.0075); lookT.x = t.clientX; lookT.y = t.clientY
    }
  }
  e.preventDefault()
}
function onTouchEnd(e) {
  for (const t of e.changedTouches) {
    touches.delete(t.identifier)
    if (t.identifier === stick.id) { stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; stickEl.classList.remove('on') }
    if (t.identifier === pinch.a || t.identifier === pinch.b) { const keep = t.identifier === pinch.a ? pinch.b : pinch.a; pinch.a = pinch.b = null; lookT.id = touches.has(keep) ? keep : null; if (lookT.id !== null) { const k = touches.get(keep); lookT.x = k.x; lookT.y = k.y } }
    else if (t.identifier === lookT.id) lookT.id = null
  }
}
// 寄る・引く（ホイール・2本指）
function zoom(d) { cam.zoom = Math.max(-3.5, Math.min(7, (cam.zoom || 0) + d)) }
addEventListener('wheel', e => { if (state === 'play') { zoom(e.deltaY * 0.006); e.preventDefault() } }, { passive: false })
const tz = $('#touchzone')
tz.addEventListener('touchstart', onTouchStart, { passive: false })
tz.addEventListener('touchmove', onTouchMove, { passive: false })
tz.addEventListener('touchend', onTouchEnd); tz.addEventListener('touchcancel', onTouchEnd)
let jumpHeldTouch = false
for (const b of document.querySelectorAll('.tbtn')) {
  const k = b.dataset.k
  const down = e => { e.preventDefault(); e.stopPropagation(); Snd.init(); b.classList.add('down'); if (k === 'jump') { edge.jump = true; jumpHeldTouch = true } else edge[k] = true }
  const up = e => { b.classList.remove('down'); if (k === 'jump') jumpHeldTouch = false }
  b.addEventListener('touchstart', down, { passive: false }); b.addEventListener('touchend', up); b.addEventListener('touchcancel', up)
  b.addEventListener('mousedown', down); b.addEventListener('mouseup', up)
}

function readInput() {
  let f = 0, r = 0
  if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1
  if (keys.has('KeyD') || keys.has('ArrowRight')) r += 1
  if (keys.has('KeyA') || keys.has('ArrowLeft')) r -= 1
  if (stick.id !== null) { f = -stick.y; r = stick.x }
  const pad = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g) : null
  let padJump = false
  if (pad) {
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0
    if (Math.hypot(ax, ay) > 0.18) { f = -ay; r = ax }
    const lx = pad.axes[2] || 0, ly = pad.axes[3] || 0
    if (Math.abs(lx) > 0.15 || Math.abs(ly) > 0.15) look(lx * 9, ly * 6, 0.006)
    padJump = pad.buttons[0]?.pressed
    if (padJump && !readInput.pj) edge.jump = true
    if (pad.buttons[2]?.pressed && !readInput.pg) edge.grab = true
    if (pad.buttons[3]?.pressed && !readInput.pm) edge.make = true
    readInput.pj = padJump; readInput.pg = pad.buttons[2]?.pressed; readInput.pm = pad.buttons[3]?.pressed
  }
  const l = Math.hypot(f, r); if (l > 1) { f /= l; r /= l }
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw)
  const inp = { mx: fx * f + -fz * r, mz: fz * f + fx * r, jump: edge.jump, jumpHeld: keys.has('Space') || jumpHeldTouch || padJump, grab: edge.grab, make: edge.make }
  edge.jump = edge.grab = edge.make = false
  return inp
}

// ---- 画面 ----
let state = 'loading', paused = false, falls = 0, startT = 0, lastSec = -1, hintKey = '', toastT = 0
const hud = $('#hud')
function show(id) { for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id; hud.hidden = id !== null && id !== 'pause' ? true : false; if (id === null) hud.hidden = false }
function toast(txt, sec = 2.2) { const t = $('#toast'); t.textContent = txt; t.classList.add('on'); toastT = sec }
function applyText() {
  for (const el of document.querySelectorAll('[data-t]')) { const k = el.dataset.t; const v = T(k); if (v != null) el.innerHTML = v }
  $('#langBtn').textContent = lang() === 'ja' ? 'English' : '日本語'
  $('#muteBtn').textContent = T(muted ? 'sound_off' : 'sound_on')
  document.documentElement.lang = lang()
}
setLang(store.get('lang', (navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en')); applyText()

const lockView = () => { if (!touch && canvas.requestPointerLock) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}) } catch (e) {} } }
$('#startBtn').onclick = () => { Snd.init(); begin(false); lockView() }
$('#contBtn').onclick = () => { Snd.init(); begin(true); lockView() }
$('#howBtn').onclick = () => show('how')
$('#howClose').onclick = () => show('title')
$('#langBtn').onclick = () => { setLang(lang() === 'ja' ? 'en' : 'ja'); store.set('lang', lang()); applyText() }
$('#muteBtn').onclick = () => { muted = !muted; Snd.setMute(muted); store.set('mute', muted); applyText() }
$('#resumeBtn').onclick = () => { pause(false); lockView() }
$('#flagBtn').onclick = () => { pause(false); respawn(W, 'manual'); falls++ }
$('#quitBtn').onclick = () => { pause(false); state = 'title'; show('title'); refreshTitle() }
$('#pauseBtn').onclick = () => pause(true)
$('#againBtn').onclick = () => begin(false)
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && state === 'play' && !paused && !touch) pause(true) })
function pause(on) { paused = on; show(on ? 'pause' : null); if (on && document.exitPointerLock) document.exitPointerLock() }
function refreshTitle() {
  const s = store.get('save', null)
  $('#contBtn').hidden = !s || s.flag < 1
  if (s && s.flag >= 1) $('#contSub').textContent = COURSE.sections[s.flag]?.[lang() === 'ja' ? 'name' : 'en'] || ''
  const best = store.get('best', null)
  $('#bestLine').textContent = best ? T('best') + ' ' + fmt(best) : ''
}
function begin(cont) {
  W = createWorld(COURSE)
  const s = store.get('save', null)
  falls = 0; startT = 0
  if (cont && s) { W.flag = Math.min(s.flag, W.flags.length - 1); for (let i = 0; i <= W.flag; i++) W.flags[i].lit = true; respawn(W, 'load'); falls = s.falls || 0; startT = s.t || 0 }
  cam.yaw = Math.PI + W.p.yaw; cam.pitch = 0.46
  state = 'play'; paused = false; show(null); lastSec = -1
  Snd.loop('wind', 'snd/wind.mp3', 0.32)
  Snd.loop('roll', 'snd/roll.mp3', 0.0001, 0.05)
}

const fmt = t => { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}` }

// ---- 進行（固定 60Hz） ----
let acc = 0, last = performance.now(), simT = 0
const dbg = { paused: false, steps: 0, inp: null }
function frame(now) {
  requestAnimationFrame(frame)
  let dt = Math.min(0.1, (now - last) / 1000); last = now
  if (state === 'play' && !paused && !dbg.paused) {
    acc += dt
    let n = 0
    while (acc >= DT && n < 6) { tick(); acc -= DT; n++ }
    if (n === 6) acc = 0
  }
  if (dbg.steps > 0) { const k = dbg.steps; dbg.steps = 0; for (let i = 0; i < k; i++) tick() }
  updateCamera(dt)
  view.render(W, dt, { groundY: groundBelow() })
  updateHud(dt)
}
let stepDist = 0, shake = 0
function loopVol(slot, v) { const l = Snd.loops[slot]; if (l && l.g && Snd.ctx) l.g.gain.setTargetAtTime(Math.max(0.0001, v), Snd.ctx.currentTime, 0.12) }
function tick() {
  const inp = dbg.inp ? dbg.inp(W) : readInput()
  step(W, inp)
  // 足音（雪を踏む）と、転がる雪玉の音
  const p = W.p
  if (p.ground && !p.mantle) {
    stepDist += Math.hypot(p.vel.x, p.vel.z) * DT
    if (stepDist > (p.deep ? 0.5 : 0.78)) { stepDist = 0; Snd.play('step', { vol: p.gmat === 'rock' ? 0.18 : 0.32, rate: p.gmat === 'ice' ? 1.3 : 1 }) }
  }
  if (W.tick % 6 === 0) {
    let lv = 0
    for (const b of W.balls) { if (!b.ground || b.gmat !== 'snow') continue; const sp = Math.hypot(b.vel.x, b.vel.z), d = Math.hypot(b.pos.x - p.pos.x, b.pos.y - p.pos.y, b.pos.z - p.pos.z); lv = Math.max(lv, Math.min(1, sp / 4) * Math.min(1, 0.4 + b.r * 0.6) / (1 + d * 0.12)) }
    loopVol('roll', lv * 0.55)
  }
  simT += DT
  if (state === 'play') startT += DT
  for (const e of W.events) onEvent(e)
}
function onEvent(e) {
  switch (e.k) {
    case 'jump': Snd.play('jump', { vol: 0.25, rate: 1.3 }); break
    case 'land': Snd.play('step', { vol: 0.4 }); if (e.h > 1.5) Snd.play('land', { vol: Math.min(0.6, 0.1 + e.h * 0.06) }); break
    case 'bigfall': toast(T('t_fell').replace('{m}', e.h.toFixed(0)), 1.8); break
    case 'make': Snd.play('make', { vol: 0.5 }); break
    case 'flag': {
      Snd.play('flag', { vol: 0.6 })
      const s = COURSE.sections[e.i]
      toast(T('t_flag') + (s ? '　' + (lang() === 'ja' ? s.name : s.en) : ''), 2.6)
      store.set('save', { flag: e.i, t: startT, falls })
      if (e.i === W.flags.length - 1) finish()
      break
    }
    case 'thud': if (e.imp > 0.3) Snd.play('thud', { vol: Math.min(0.6, 0.15 + e.imp * 0.1) }); break
    case 'void': Snd.play('fall', { vol: 0.35 }); break
    case 'respawn': if (e.why === 'void') { falls++; flash() } break
    case 'grab': case 'stack': case 'drop': Snd.play('grab', { vol: 0.4 }); break
    case 'tooHeavy': toast(T('t_heavy'), 1.4); break
    case 'makeNo': if (e.why === 'rock' || e.why === 'ice' || e.why === 'ball') toast(T('t_nosnow'), 1.4); break
    case 'break': Snd.play('crack', { vol: 0.8 }); Snd.play('thud', { vol: 0.6 }); view.shatter(e, W); shake = 0.5; break
  }
}
function flash() { const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on') }
function finish() {
  state = 'done'
  Snd.play('finish', { vol: 0.6 })
  const t = startT, best = store.get('best', null)
  if (!best || t < best) store.set('best', t)
  store.set('save', null)
  $('#resTime').textContent = fmt(t)
  $('#resFalls').textContent = String(falls)
  setTimeout(() => { if (document.exitPointerLock) document.exitPointerLock(); show('result') }, 1600)
}

// 足元の真下の面（丸い影を落とす所）
function groundBelow() {
  const p = W.p.pos, o = { x: p.x, y: p.y + 0.5, z: p.z }
  let best = null
  for (const b of W.boxes) { const h = rayBox(o, { x: 0, y: -1, z: 0 }, b, 40); if (h && (best == null || h.t < best)) best = h.t }
  for (const b of W.balls) { const dx = p.x - b.pos.x, dz = p.z - b.pos.z, d2 = dx * dx + dz * dz; if (d2 < b.r * b.r && b !== W.p.hold) { const y = b.pos.y + Math.sqrt(b.r * b.r - d2); const t = o.y - y; if (t > 0 && (best == null || t < best)) best = t } }
  return best == null ? null : o.y - best
}

// ---- カメラ ----
const _t = new THREE.Vector3()
// 転がり落ちる雪玉を追う（あああ…の見せ場）
const touchT = new Map()
let chase = null
function watchRunaway(dt) {
  const p = W.p
  if (p.push) touchT.set(baseOf(p.push.b).id, simT)
  if (p.gBall) touchT.set(baseOf(p.gBall).id, simT)
  if (p.hold) touchT.set(p.hold.id, simT)
  if (chase) {
    chase.t += dt
    const b = W.balls.find(o => o.id === chase.id)
    const sp = b ? Math.hypot(b.vel.x, b.vel.y, b.vel.z) : 0
    if (!b || chase.t > 4.5 || (sp < 0.6 && chase.t > 1.2) || Math.hypot(readMove().f, readMove().r) > 0.1 && chase.t > 1.5) { chase.out = (chase.out || 0) + dt } 
    if (b) chase.pos = { x: b.pos.x, y: b.pos.y, z: b.pos.z }
    if ((chase.out || 0) > 0.6) chase = null
    return
  }
  for (const b of W.balls) {
    if (b.on || b.held || b.r < 0.75 || b.chased) continue
    const sp = Math.hypot(b.vel.x, b.vel.z)
    const dist = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z)
    if (sp > 3.2 && b.vel.y < -0.4 && simT - (touchT.get(b.id) ?? -9) > 0.5 && simT - (touchT.get(b.id) ?? -99) < 8 && dist > 2.5) {
      b.chased = true
      chase = { id: b.id, t: 0, pos: { x: b.pos.x, y: b.pos.y, z: b.pos.z } }
      Snd.play('fall', { vol: 0.5, rate: 0.8 }); Snd.duck(0.5, 2.5)
      break
    }
  }
  for (const b of W.balls) if (b.chased && Math.hypot(b.vel.x, b.vel.z) < 0.3) b.chased = false
}
function readMove() { let f = 0, r = 0; if (keys.has('KeyW') || keys.has('ArrowUp')) f++; if (keys.has('KeyS') || keys.has('ArrowDown')) f--; if (keys.has('KeyD') || keys.has('ArrowRight')) r++; if (keys.has('KeyA') || keys.has('ArrowLeft')) r--; if (stick.id !== null) { f = -stick.y; r = stick.x } return { f, r } }
function updateCamera(dt) {
  const p = W.p
  if (state === 'title' || state === 'loading') {
    // タイトル: 下から岩塔と山頂の灯台を見上げ、ゆっくり回る
    const a = performance.now() / 1000 * 0.03
    view.camera.position.set(-26 + Math.sin(a) * 8, 6, -22 + Math.cos(a) * 4)
    view.camera.lookAt(6, 22, 90)
    cam.cur.set(0, 0, 0); cam.d = null
    return
  }
  if (state === 'play') watchRunaway(dt)
  _t.set(p.pos.x, p.pos.y + 1.6, p.pos.z)
  if (chase) {
    // 人と雪玉の間を見る。少し引いて、雪玉の側を向く
    const c = chase.pos, k = Math.min(1, chase.t / 0.8) * (1 - Math.min(1, (chase.out || 0) / 0.6))
    _t.x += (c.x - _t.x) * 0.55 * k; _t.y += (c.y - _t.y) * 0.55 * k; _t.z += (c.z - _t.z) * 0.55 * k
    const want = Math.atan2(p.pos.x - c.x, p.pos.z - c.z)
    let d = want - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d))
    cam.yaw += d * Math.min(1, dt * 2.2) * k
    cam.extra = 4.5 * k
  } else {
    // 押している・乗っている雪玉が大きいほど引いて、雪玉が人に隠れないようにする
    const bb = p.push ? p.push.b : p.gBall
    const want = bb ? Math.min(4, bb.r * 2.2) : 0
    cam.extra = (cam.extra || 0) + (want - (cam.extra || 0)) * Math.min(1, dt * (want > (cam.extra || 0) ? 2 : 0.6))
  }
  if (cam.cur.lengthSq() === 0) cam.cur.copy(_t)
  // 上下はゆっくり、左右は速く追う（跳ぶたびに画面が揺れない）
  cam.cur.x += (_t.x - cam.cur.x) * Math.min(1, dt * 10)
  cam.cur.z += (_t.z - cam.cur.z) * Math.min(1, dt * 10)
  cam.cur.y += (_t.y - cam.cur.y) * Math.min(1, dt * (p.ground ? 6 : 2.5))
  // 歩いている間、しばらく見回さなければ背中側へゆっくり回る
  cam.auto = Math.max(0, cam.auto - dt)
  const sp = Math.hypot(p.vel.x, p.vel.z)
  if (cam.auto <= 0 && sp > 1 && state === 'play' && !p.mantle && !chase) {
    const want = p.yaw + Math.PI
    let d = want - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d))
    if (Math.abs(d) < 2.4) cam.yaw += d * Math.min(1, dt * 0.9)
  }
  const cp = Math.cos(cam.pitch)
  const dir = { x: Math.sin(cam.yaw) * cp, y: Math.sin(cam.pitch), z: Math.cos(cam.yaw) * cp }
  let dist = Math.max(2.2, cam.dist + (cam.extra || 0) + (cam.zoom || 0))
  // 壁に埋まらない
  for (const b of W.boxes) { if (b.prop) continue; const h = rayBox({ x: cam.cur.x, y: cam.cur.y, z: cam.cur.z }, dir, b, dist); if (h && h.t < dist) dist = Math.max(1.2, h.t - 0.35) }
  cam.d = cam.d == null ? dist : (dist < cam.d ? dist : cam.d + (dist - cam.d) * Math.min(1, dt * 3))
  view.camera.position.set(cam.cur.x + dir.x * cam.d, cam.cur.y + dir.y * cam.d, cam.cur.z + dir.z * cam.d)
  view.camera.lookAt(cam.cur.x, cam.cur.y, cam.cur.z)
  if (shake > 0) { shake = Math.max(0, shake - dt); const k = shake * 0.25; view.camera.position.x += (Math.random() - 0.5) * k; view.camera.position.y += (Math.random() - 0.5) * k }
}

// ---- 画面の文字 ----
function curSection() { let s = COURSE.sections[0]; for (const x of COURSE.sections) if (W.p.pos.z >= x.z - 0.5 && W.p.pos.y >= x.y - 1.5) s = x; return s }
function updateHud(dt) {
  if (state !== 'play') return
  toastT -= dt; if (toastT <= 0) $('#toast').classList.remove('on')
  const s = curSection()
  if (s.i !== lastSec) { lastSec = s.i; $('#secName').textContent = lang() === 'ja' ? s.name : s.en; $('#secNo').textContent = String(s.i + 1).padStart(2, '0') }
  $('#alt').textContent = `${Math.max(0, W.p.pos.y).toFixed(0)}m`
  // ひとこと（その場所の案内。1つだけ）
  let hk = ''
  for (const h of COURSE.hints) { const p = W.p.pos; if (p.x >= h.x0 && p.x <= h.x1 && p.z >= h.z0 && p.z <= h.z1 && p.y >= h.y0 && p.y <= h.y1) { hk = h.key; break } }
  if (hk !== hintKey) { hintKey = hk; const el = $('#hint'); el.textContent = hk ? T(hk + (touch ? '_t' : '')) ?? T(hk) : ''; el.classList.toggle('on', !!hk) }
  // 雪玉の大きさ（押している玉 → 持っている玉 → 一番近い玉）
  const p = W.p
  let b = p.push ? p.push.b : p.hold || (p.gBall ? baseOf(p.gBall) : null)
  if (!b) { let bd = 9; for (const o of W.balls) { const d = Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z) - o.r; if (d < bd && Math.abs(o.pos.y - p.pos.y) < 4) { bd = d; b = o } } }
  const g = $('#gauge')
  if (b) {
    g.classList.add('on')
    const dia = b.r * 2
    $('#gDia').textContent = dia.toFixed(1)
    $('#gFill').style.width = Math.min(100, dia / (K.rMax * 2) * 100) + '%'
    let tag = ''
    if (b.r <= K.rGrab) tag = T('g_lift')
    else if (b.r > K.rPush) tag = T('g_heavy')
    if (b.sun) tag = T('g_melt')
    $('#gTag').textContent = tag
  } else g.classList.remove('on')
  // 日なた・吹雪の時間
  const zz = W.zones.find(z => (z.kind === 'sun' || z.kind === 'wind') && z.period && p.pos.x > z.x0 - 6 && p.pos.x < z.x1 + 6 && p.pos.z > z.z0 - 8 && p.pos.z < z.z1 + 2 && Math.abs(p.pos.y - z.y0) < 6)
  const sk = $('#sky')
  if (zz) {
    const st = zoneState(W, zz)
    sk.classList.add('on')
    sk.dataset.k = zz.kind + (st.on ? '1' : '0')
    $('#skyTxt').textContent = T(zz.kind === 'sun' ? (st.on ? 's_sun' : 's_cloud') : (st.on ? 's_wind' : 's_calm'))
    $('#skyT').textContent = Math.ceil(st.left)
  } else sk.classList.remove('on')
  // 置く先の印
  const ring = view.ring
  if (p.hold) {
    const t = placeTarget(W)
    ring.visible = true
    if (t.kind === 'stack') { ring.position.set(t.on.pos.x, t.on.pos.y + t.on.r + 0.05, t.on.pos.z); ring.scale.setScalar(Math.max(1, p.hold.r * 2)); ring.material.color.setHex(0xffd27a) }
    else { const gy = groundBelow(); ring.position.set(t.x, (gy ?? p.pos.y) + 0.03, t.z); ring.scale.setScalar(p.hold.r * 2); ring.material.color.setHex(0xffffff) }
  } else ring.visible = false
  // 押す・持つボタンの表示
  $('#bGrab').classList.toggle('lit', !!p.hold)
  $('#bGrab').querySelector('b').textContent = T(p.hold ? 'b_put' : 'b_grab')
}

// ---- 読み込み ----
const ldFill = $('#ldFill')
function waitLoad() {
  return new Promise(ok => {
    const t0 = performance.now()
    const iv = setInterval(() => {
      const k = View.toLoad ? View.loaded / View.toLoad : 1
      ldFill.style.width = Math.round(k * 100) + '%'
      if ((k >= 1 && view.hero.ready) || performance.now() - t0 > 12000) { clearInterval(iv); ok() }
    }, 80)
  })
}
requestAnimationFrame(frame)
waitLoad().then(() => {
  state = 'title'; show('title'); refreshTitle()
  // タイトルの後ろでは山を見せる
  cam.yaw = Math.PI * 0.82; cam.pitch = 0.18
  window.__snowReady = true
})

// ---- 検査用の窓口 ----
window.snow = {
  get W() { return W }, K, COURSE, snapshot: () => snapshot(W), makeBall: (x, y, z, r) => makeBall(W, x, y, z, r),
  dbg, begin, pause, cam, view, get chase() { return chase },
  state: () => state,
  teleport(i) { W.flag = i; for (let k = 0; k <= i; k++) W.flags[k].lit = true; respawn(W, 'tp'); cam.yaw = Math.PI + W.p.yaw },
}
window.__jsUp = true
