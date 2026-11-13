// 主人公: Quaternius「Ultimate Modular Men」の Adventurer（CC0・等身の高い人物・背嚢つき）。
// A の絵に寄せて、上着を厚手の茶色、ズボンを濃い灰に塗り、ニット帽と赤いマフラーを骨に付ける。
// 押す・持つ・跳ぶ・よじ登る・玉乗りは、歩き/走り/待機のアニメの上から、骨を「世界の向きの軸」で回して作る
// （骨ごとのローカル軸を知らなくても、前へ・横へが正しく曲がる）。
import * as THREE from 'three'
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js'

const COLORS = { Green: 0x6e5238, LightGreen: 0x7d6246, Grey: 0x3a3634, Brown: 0x3e3a38, Brown2: 0x2c2826, Black: 0x1c1a1a, Gold: 0x8a6a3a }

export function loadHero(scene) {
  const H = { ready: false, root: new THREE.Group(), mixer: null, acts: {}, cur: null, bones: {} }
  scene.add(H.root)
  new GLTFLoader().load('assets/models/climber.glb', gltf => {
    const m = gltf.scene
    // 身長を 1.72m に
    const box = new THREE.Box3().setFromObject(m), h = box.max.y - box.min.y
    m.scale.setScalar(1.72 / h); m.position.y = -box.min.y * 1.72 / h
    m.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        const nm = mats.map(mt => {
          const c = mt.clone(); c.roughness = 0.9; c.metalness = 0
          if (COLORS[mt.name] != null) c.color.setHex(COLORS[mt.name])
          return c
        })
        o.material = Array.isArray(o.material) ? nm : nm[0]
      }
      if (o.isBone) H.bones[o.name] = o
    })
    H.root.add(m)
    // ニット帽（折り返し・ぼんぼん）とマフラー（首の輪＋背中へ垂れる2本）
    const knit = new THREE.MeshStandardMaterial({ color: 0x8c8276, roughness: 1 })
    const red = new THREE.MeshStandardMaterial({ color: 0x9a2a24, roughness: 0.95 })
    const head = H.bones.Head, neck = H.bones.Neck || H.bones.Chest
    // 骨の中の大きさ（モデルの縮尺と骨の縮尺を打ち消す）
    m.updateMatrixWorld(true)
    const ws = b => { const v = new THREE.Vector3(); b.getWorldScale(v); return 1 / v.x }
    if (head) {
      const g = new THREE.Group(); g.scale.setScalar(ws(head)); head.add(g)
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.128, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), knit); cap.position.set(0, 0.13, -0.005); cap.scale.set(1, 1.05, 1.08); g.add(cap)
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.134, 0.06, 18), knit); band.position.set(0, 0.125, -0.005); g.add(band)
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), knit); pom.position.set(0, 0.27, -0.01); g.add(pom)
      for (const o of [cap, band, pom]) o.castShadow = true
      H.cap = g
    }
    if (neck) {
      const g = new THREE.Group(); g.scale.setScalar(ws(neck)); neck.add(g)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.04, 8, 18), red); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.02, 0); g.add(ring)
      const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.025), red); t1.position.set(0.05, -0.15, -0.11); t1.rotation.x = 0.25; g.add(t1)
      const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, 0.025), red); t2.position.set(-0.02, -0.13, -0.12); t2.rotation.x = 0.3; g.add(t2)
      for (const o of [ring, t1, t2]) o.castShadow = true
      H.tails = [t1, t2]; H.scarf = g
    }
    // 厚手の袖（半袖の腕を上着の色で包む。骨から次の骨へ向けた筒）
    const coat = new THREE.MeshStandardMaterial({ color: 0x6e5238, roughness: 0.95 })
    const glove = new THREE.MeshStandardMaterial({ color: 0x2c2420, roughness: 0.9 })
    for (const s of ['L', 'R']) for (const [a, b, r0, r1, mat] of [['UpperArm' + s, 'LowerArm' + s, 0.07, 0.062, coat], ['LowerArm' + s, 'Wrist' + s, 0.062, 0.05, coat], ['Wrist' + s, null, 0.045, 0.04, glove]]) {
      const A = H.bones[a]; if (!A) continue
      const B2 = b ? H.bones[b] : null
      const k = ws(A) // 世界 1m あたりの骨のローカルの長さ
      const dir = B2 ? B2.position.clone() : new THREE.Vector3(0, 0.09 / k, 0)
      const len = dir.length(); if (len < 1e-6) continue
      const g = new THREE.CylinderGeometry(r1 * k, r0 * k, len * (b ? 1.04 : 1), 10); g.translate(0, len / 2, 0)
      const me = new THREE.Mesh(g, mat); me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); me.castShadow = true
      A.add(me)
    }
    H.rest = Object.values(H.bones).map(b => [b, b.quaternion.clone()])
    H.mixer = new THREE.AnimationMixer(m)
    for (const c of gltf.animations) H.acts[c.name] = H.mixer.clipAction(c)
    H.ready = true
  }, undefined, () => { H.failed = true })

  function play(name, fade = 0.2, speed = 1) {
    const a = H.acts[name]; if (!a) return
    a.timeScale = speed
    if (H.cur === a) return
    a.reset().play()
    if (H.cur) a.crossFadeFrom(H.cur, fade, false)
    H.cur = a
  }
  // 骨を世界の軸まわりに回す
  const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _ax = new THREE.Vector3()
  function turn(bone, axis, ang) {
    if (!bone || !ang) return
    bone.parent.getWorldQuaternion(_pq)
    _ax.copy(axis).applyQuaternion(_pq.invert())
    _q.setFromAxisAngle(_ax, ang)
    bone.quaternion.premultiply(_q)
    bone.updateMatrixWorld(true)
  }
  const pose = { push: 0, hold: 0, hang: 0, ride: 0, air: 0, stuck: 0 }
  const L = (k, v, s) => { pose[k] += (v - pose[k]) * s }
  const RIGHT = new THREE.Vector3(), FWD = new THREE.Vector3()
  H.update = (p, dt, t) => {
    if (!H.ready) return
    const sp = Math.hypot(p.vel.x, p.vel.z)
    let clip = 'Idle', speed = 1
    if (p.mantle || !p.ground) clip = 'Idle'
    else if (p.push) { clip = 'Walk'; speed = p.push.stuck ? 0.3 : Math.max(0.5, sp / 1.6) }
    else if (sp > 3.0) { clip = 'Run'; speed = sp / 4.3 }
    else if (sp > 0.25) { clip = 'Walk'; speed = Math.max(0.6, sp / 1.5) }
    if (p.deep && sp > 0.2) { clip = 'Walk'; speed = 0.5 }
    play(clip, 0.2, speed)
    // アニメの付いていない骨に、前のフレームの曲げがたまらないよう元に戻す
    for (const [b, q] of H.rest) b.quaternion.copy(q)
    H.mixer.update(dt)
    H.root.updateMatrixWorld(true)
    const k = Math.min(1, dt * 9)
    L('push', p.push ? 1 : 0, k); L('stuck', p.push && p.push.stuck ? 1 : 0, k); L('hold', p.hold ? 1 : 0, k)
    L('hang', p.mantle ? 1 : 0, Math.min(1, dt * 14)); L('ride', p.gBall && p.ground ? 1 : 0, k); L('air', !p.ground && !p.mantle ? 1 : 0, Math.min(1, dt * 8))
    const yaw = p.yaw
    FWD.set(Math.sin(yaw), 0, Math.cos(yaw)); RIGHT.set(Math.cos(yaw), 0, -Math.sin(yaw))
    const B = H.bones, S = H.sign || 1
    if (pose.push > 0.01) {
      const w = pose.push
      turn(B.Abdomen || B.Torso, RIGHT, S * 0.32 * w); turn(B.Chest, RIGHT, S * (0.2 * w + 0.1 * pose.stuck))
      for (const s of ['L', 'R']) { turn(B['UpperArm' + s], RIGHT, -S * 1.25 * w); turn(B['LowerArm' + s], RIGHT, -S * 0.35 * w) }
      turn(B.Head, RIGHT, -S * 0.35 * w)
    }
    if (pose.hold > 0.01) { for (const s of ['L', 'R']) { turn(B['UpperArm' + s], RIGHT, -S * 2.3 * pose.hold); turn(B['LowerArm' + s], RIGHT, -S * 0.5 * pose.hold) } }
    if (pose.hang > 0.01) {
      for (const s of ['L', 'R']) turn(B['UpperArm' + s], RIGHT, -S * 2.7 * pose.hang)
      turn(B['UpperLegL'], RIGHT, -S * 0.9 * pose.hang); turn(B['LowerLegL'], RIGHT, S * 1.2 * pose.hang)
    }
    if (pose.air > 0.01) {
      const w = pose.air
      turn(B['UpperArmL'], FWD, -0.9 * w); turn(B['UpperArmR'], FWD, 0.9 * w)
      turn(B['UpperLegL'], RIGHT, -S * 0.6 * w); turn(B['LowerLegL'], RIGHT, S * 0.9 * w)
      turn(B['UpperLegR'], RIGHT, -S * 0.2 * w); turn(B['LowerLegR'], RIGHT, S * 0.6 * w)
    }
    if (pose.ride > 0.01) {
      const w = pose.ride, s = Math.sin(t * 4) * 0.25
      turn(B['UpperArmL'], FWD, (-1.2 - s) * w); turn(B['UpperArmR'], FWD, (1.2 - s) * w)
      turn(B.Abdomen || B.Torso, FWD, s * 0.3 * w)
    }
    if (H.tails) H.tails.forEach((tl, i) => { tl.rotation.x = 0.25 + Math.min(1.1, sp * 0.18) + Math.sin(t * 6 + i) * 0.08 })
  }
  return H
}
