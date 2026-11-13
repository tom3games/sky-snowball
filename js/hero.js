// 主人公: KayKit Adventurers の Rogue_Hooded（CC0・ボーン入り）。外套の緑を A の絵の茶色の毛皮外套へ塗り替え、
// 押す・持つ・よじ登る・玉乗りは、歩きのアニメの上から腕と胴の骨を手で曲げて作る。
import * as THREE from 'three'
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js'

const HIDE = ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable']

// 色の表（8x4 のマス）。緑のマスを茶色・生成り・赤のマフラーへ
function recolor(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const g = c.getContext('2d'); g.drawImage(img, 0, 0)
  const cw = img.width / 8, ch = img.height / 4
  const paint = (col, row, top, bot) => { const gr = g.createLinearGradient(0, row * ch, 0, (row + 1) * ch); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(col * cw, row * ch, cw, ch) }
  paint(0, 1, '#9a3a2c', '#5e1e1a')  // 濃い緑 → 赤
  paint(1, 1, '#94744f', '#4e3826')  // 明るい緑 → 毛皮の外套
  paint(1, 2, '#8a6a4c', '#4a3626')
  paint(2, 2, '#c9b48a', '#7a6248')  // 黄緑 → 生成り
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false
  return t
}

export function loadHero(scene) {
  const H = { ready: false, root: new THREE.Group(), mixer: null, acts: {}, cur: null, bones: {} }
  scene.add(H.root)
  new GLTFLoader().load('assets/models/hero.glb', gltf => {
    const m = gltf.scene
    m.scale.setScalar(0.95)
    let tex = null
    m.traverse(o => {
      if (HIDE.includes(o.name)) o.visible = false
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = false
        if (o.material && o.material.map) {
          if (!tex) tex = recolor(o.material.map.image)
          o.material = o.material.clone(); o.material.map = tex; o.material.roughness = 0.85
        }
      }
      if (o.isBone) H.bones[o.name] = o
    })
    H.root.add(m)
    H.mixer = new THREE.AnimationMixer(m)
    for (const c of gltf.animations) H.acts[c.name] = H.mixer.clipAction(c)
    H.ready = true
  })
  function play(name, fade = 0.18, speed = 1) {
    const a = H.acts[name]; if (!a) return
    a.timeScale = speed
    if (H.cur === a) return
    a.reset().play()
    if (H.cur) a.crossFadeFrom(H.cur, fade, false)
    H.cur = a
  }
  const L = (o, k, v, s) => { o[k] += (v - o[k]) * s }
  const pose = { push: 0, hold: 0, hang: 0, ride: 0 }
  H.update = (p, dt, t) => {
    if (!H.ready) return
    const sp = Math.hypot(p.vel.x, p.vel.z)
    let clip = 'Idle', speed = 1
    if (p.mantle) clip = 'Jump_Idle'
    else if (!p.ground) clip = p.vel.y > 0 ? 'Jump_Start' : 'Jump_Idle'
    else if (p.stun > 0) clip = 'Hit_B'
    else if (p.gBall) clip = sp > 0.5 ? 'Walking_B' : 'Idle'
    else if (p.push) { clip = 'Walking_A'; speed = p.push.stuck ? 0.35 : 0.8 }
    else if (sp > 3.2) { clip = 'Running_A'; speed = sp / 4.6 }
    else if (sp > 0.25) { clip = 'Walking_A'; speed = Math.max(0.6, sp / 1.9) }
    if (p.deep && sp > 0.2) { clip = 'Walking_A'; speed = 0.55 }
    play(clip, 0.18, speed)
    H.mixer.update(dt)
    // 手で曲げる（アニメの後に足す）
    const k = Math.min(1, dt * 10)
    L(pose, 'push', p.push ? 1 : 0, k); L(pose, 'hold', p.hold ? 1 : 0, k)
    L(pose, 'hang', p.mantle ? 1 : 0, Math.min(1, dt * 16)); L(pose, 'ride', p.gBall && p.ground ? 1 : 0, k)
    const B = H.bones
    const arm = (side, x, z) => { const u = B['upperarm.' + side]; if (u) { u.rotation.x += x; u.rotation.z += z } }
    if (pose.push > 0.01) { arm('l', -1.2 * pose.push, 0); arm('r', -1.2 * pose.push, 0); if (B.spine) B.spine.rotation.x += 0.35 * pose.push }
    if (pose.hold > 0.01) { arm('l', -2.4 * pose.hold, 0); arm('r', -2.4 * pose.hold, 0) }
    if (pose.hang > 0.01) { arm('l', -2.8 * pose.hang, 0); arm('r', -2.8 * pose.hang, 0) }
    if (pose.ride > 0.01) { arm('l', 0, 1.1 * pose.ride * (1 + Math.sin(t * 5) * 0.15)); arm('r', 0, -1.1 * pose.ride * (1 + Math.cos(t * 5) * 0.15)) }
  }
  return H
}
