// コンセプト画 A「極夜の玄武岩の灯台」の世界。空・オーロラ・星・玄武岩の柱・つらら・ランタン・灯台・奥で転がる巨大な雪玉・凍った海。
// 当たりのある物はここで作らない（柱は箱の面から 0.12m 以内しか出さない。ほかは手の届かない所）。
// パレット（A から抜いた色）
export const PAL = {
  skyTop: 0x141b40, sky: 0x2b3668, horizon: 0xc79ab8, aurora1: 0xc25ad8, aurora2: 0x6f6bff,
  basalt: 0x2c2d36, basaltHi: 0x4a4650, snow: 0xdfe5ff, snowShade: 0x7d86c0, lamp: 0xffb45a, flag: 0xd9b34a, fog: 0x3b4374,
}
import * as THREE from 'three'

let seed = 5
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

export function buildNight(scene, W, M, opt) {
  const out = { lamps: [], lights: [], tick: [] }

  // ---- 空 ----
  {
    const geo = new THREE.SphereGeometry(950, 48, 24)
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { t: { value: 0 }, top: { value: new THREE.Color(PAL.skyTop) }, mid: { value: new THREE.Color(PAL.sky) }, hor: { value: new THREE.Color(PAL.horizon) }, a1: { value: new THREE.Color(PAL.aurora1) }, a2: { value: new THREE.Color(PAL.aurora2) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        varying vec3 vP; uniform float t; uniform vec3 top, mid, hor, a1, a2;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){
          float y = vP.y;
          vec3 c = mix(hor, mid, smoothstep(-0.02, 0.22, y));
          c = mix(c, top, smoothstep(0.22, 0.75, y));
          // オーロラ（地平線から 10〜45 度、ゆっくり揺れるカーテン）
          float az = atan(vP.x, vP.z);
          float band = sin(az * 3.0 + n(vec2(az * 2.0, t * 0.05)) * 3.0 + t * 0.03) * 0.06 + 0.26;
          float d = abs(y - band);
          float curtain = smoothstep(0.16, 0.0, d) * (0.55 + 0.45 * n(vec2(az * 40.0, t * 0.15)));
          float rays = pow(n(vec2(az * 90.0, t * 0.2)), 2.0);
          float a = curtain * (0.35 + rays) * smoothstep(0.02, 0.12, y);
          vec3 ac = mix(a2, a1, smoothstep(band - 0.05, band + 0.12, y));
          c += ac * a * 0.9;
          // 星
          vec2 sp = vec2(az * 160.0, y * 260.0);
          float s = step(0.9975, h(floor(sp))) * smoothstep(0.08, 0.4, y);
          c += vec3(s) * (0.6 + 0.4 * sin(t * 2.0 + h(floor(sp)) * 40.0));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    })
    const sky = new THREE.Mesh(geo, mat); sky.renderOrder = -10; scene.add(sky)
    out.tick.push((t, cam) => { mat.uniforms.t.value = t; sky.position.copy(cam.position) })
  }

  // ---- 玄武岩の柱（崖の面に六角の柱を並べる。面から 0.12m までしか出ない） ----
  {
    const colGeo = new THREE.CylinderGeometry(0.46, 0.46, 1, 6, 1)
    colGeo.translate(0, -0.5, 0) // 上端を原点に
    const colMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.08, flatShading: true })
    const capGeo = new THREE.CylinderGeometry(0.5, 0.46, 0.16, 6, 1)
    const capMat = new THREE.MeshStandardMaterial({ map: M.snow.map, color: PAL.snow, roughness: 0.95 })
    const iceGeo = new THREE.ConeGeometry(0.06, 1, 5); iceGeo.rotateX(Math.PI); iceGeo.translate(0, -0.5, 0)
    // ConeGeometry は先が +y。rotateX(π) で先が下
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfd6ff, roughness: 0.1, metalness: 0.0, transparent: true, opacity: 0.85 })
    const cols = [], caps = [], ices = []
    const inside = (x, y, z, self) => W.boxes.some(b => b !== self && !b.pitch && !b.roll && x > b.min.x && x < b.max.x && y > b.min.y && y < b.max.y && z > b.min.z && z < b.max.z)
    for (const b of W.boxes) {
      if (b.pitch || b.roll || b.gate) continue
      const top = b.max.y
      const bot = Math.max(b.min.y, top - 16)
      if (top - bot < 0.6) continue
      const faces = [[1, 0, b.max.x, b.min.z, b.max.z], [-1, 0, b.min.x, b.min.z, b.max.z], [0, 1, b.max.z, b.min.x, b.max.x], [0, -1, b.min.z, b.min.x, b.max.x]]
      for (const [nx, nz, f, a0, a1] of faces) {
        const L = a1 - a0, n = Math.max(1, Math.round(L / 0.8)), step = L / n
        for (let i = 0; i < n; i++) {
          const a = a0 + step * (i + 0.5)
          const x = nx ? f + nx * 0.02 : a, z = nz ? f + nz * 0.02 : a
          // 外に別の箱がある所（埋まる所）には置かない
          if (inside(x + nx * 0.6, top - 0.6, z + nz * 0.6, b)) continue
          const cx = x - nx * 0.34 + (rnd() - 0.5) * 0.04, cz = z - nz * 0.34
          const dt = rnd() < 0.2 ? 0.3 + rnd() * 0.5 : 0.04 + rnd() * 0.18 // 柱の頭は少し下がって段々に
          const len = top - dt - bot
          cols.push([cx, top - dt, cz, len, rnd() * 6, 0.8 + rnd() * 0.2])
          if (b.mat !== 'ice') caps.push([cx, top - dt + 0.05, cz, cols[cols.length - 1][5], cols[cols.length - 1][4]])
          // つらら（崖の上の縁、手前に向いた面に多く）
          if (top - bot > 2 && rnd() < (nz < 0 ? 0.55 : 0.25)) ices.push([x + nx * 0.06, top - dt - 0.02, z + nz * 0.06, 0.25 + rnd() * rnd() * 1.1])
        }
      }
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
    const cI = new THREE.InstancedMesh(colGeo, colMat, cols.length)
    cols.forEach(([x, y, z, l, r, w], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r); m4.compose(p.set(x, y, z), q, s.set(w, l, w)); cI.setMatrixAt(i, m4) })
    const cc = new THREE.Color(); cols.forEach((_, i) => { const v = 0.75 + rnd() * 0.35; cc.setHex(PAL.basalt).multiplyScalar(v * 1.25); if (rnd() < 0.12) cc.lerp(new THREE.Color(0x4a3a30), 0.5); cI.setColorAt(i, cc) })
    cI.castShadow = false; cI.receiveShadow = true; scene.add(cI)
    const kI = new THREE.InstancedMesh(capGeo, capMat, caps.length)
    caps.forEach(([x, y, z, w, r], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r); m4.compose(p.set(x, y, z), q, s.set(w, 1, w)); kI.setMatrixAt(i, m4) })
    kI.receiveShadow = true; scene.add(kI)
    const iI = new THREE.InstancedMesh(iceGeo, iceMat, ices.length)
    ices.forEach(([x, y, z, l], i) => { m4.compose(p.set(x, y, z), q.identity(), s.set(1 + l * 0.6, l, 1 + l * 0.6)); iI.setMatrixAt(i, m4) })
    scene.add(iI)
    out.counts = { cols: cols.length, caps: caps.length, ices: ices.length }
  }

  // ---- ランタン（琥珀の光で、次に登る所を示す） ----
  {
    const glowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64
      const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.25, 'rgba(255,170,80,0.55)'); gr.addColorStop(1, 'rgba(255,140,60,0)')
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
    })()
    const post = new THREE.MeshStandardMaterial({ color: 0x3a2e26, roughness: 0.85 })
    const iron = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.5, metalness: 0.7 })
    const glass = new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: PAL.lamp, emissiveIntensity: 2.4, roughness: 0.3 })
    const glowM = new THREE.SpriteMaterial({ map: glowTex, color: 0xffc27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
    const pts = [...(W.course.lamps || []), ...W.flags.map(f => ({ x: f.x + 0.7, y: f.y, z: f.z - 0.2 }))]
    for (const L of pts) {
      const g = new THREE.Group(); g.position.set(L.x, L.y, L.z)
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 0.1), post); pole.position.y = 0.95; pole.castShadow = true; g.add(pole)
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.06), post); arm.position.set(0.18, 1.85, 0); g.add(arm)
      const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.28, 6), glass); cage.position.set(0.34, 1.62, 0); g.add(cage)
      const lid = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.1, 6), iron); lid.position.set(0.34, 1.81, 0); g.add(lid)
      const sp = new THREE.Sprite(glowM); sp.position.set(0.34, 1.62, 0); sp.scale.setScalar(2.2); g.add(sp)
      scene.add(g)
      out.lamps.push({ x: L.x + 0.34, y: L.y + 1.62, z: L.z, sp, ph: rnd() * 6 })
    }
    // 近いランタンだけ本物の光（数を抑える）
    for (let i = 0; i < 5; i++) { const l = new THREE.PointLight(PAL.lamp, 0, 13, 1.6); scene.add(l); out.lights.push(l) }
    let k = 0
    out.tick.push((t, cam, player) => {
      for (const L of out.lamps) L.sp.material && (L.sp.scale.setScalar(2.1 + Math.sin(t * 7 + L.ph) * 0.08 + Math.sin(t * 13 + L.ph) * 0.05))
      if ((k++ % 10) !== 0) return
      const P = player
      const near = out.lamps.map(L => ({ L, d: (L.x - P.x) ** 2 + (L.y - P.y) ** 2 * 2 + (L.z - P.z) ** 2 })).sort((a, b) => a.d - b.d)
      out.lights.forEach((l, i) => { const n = near[i]; if (!n) { l.intensity = 0; return } l.position.set(n.L.x, n.L.y, n.L.z); l.intensity = 12 })
    })
  }

  // ---- 山頂の灯台（手の届かない岩の柱の上） ----
  {
    const s = W.course.summit, g = new THREE.Group()
    g.position.set(s.x + 19, s.y - 6, s.z + 6)
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 30, 7), new THREE.MeshStandardMaterial({ map: M.cliff.map, normalMap: M.cliff.normalMap, color: 0x4a4a58, roughness: 0.85 }))
    rock.position.y = -9; g.add(rock)
    const white = new THREE.MeshStandardMaterial({ color: 0xc8c4be, roughness: 0.8 })
    const red = new THREE.MeshStandardMaterial({ color: 0x7a3a2e, roughness: 0.8 })
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.3, 13, 16), white); tower.position.y = 12.5; g.add(tower)
    for (const y of [9, 14]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(2.02 - (y - 6) * 0.04, 2.08 - (y - 6) * 0.04, 1.2, 16), red); band.position.y = y; g.add(band) }
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.25, 16), new THREE.MeshStandardMaterial({ color: 0x2a2624, metalness: 0.6, roughness: 0.5 })); gallery.position.y = 19.1; g.add(gallery)
    const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 1.8, 12), new THREE.MeshStandardMaterial({ color: 0xffd290, emissive: PAL.lamp, emissiveIntensity: 3 })); lampRoom.position.y = 20.1; g.add(lampRoom)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.4, 12), red); roof.position.y = 21.7; g.add(roof)
    // 回る光の筋
    const beamG = new THREE.ConeGeometry(4, 60, 24, 1, true); beamG.translate(0, -30, 0); beamG.rotateZ(Math.PI / 2)
    const beamM = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })
    const beam = new THREE.Group(); beam.position.y = 20.1; g.add(beam)
    const b1 = new THREE.Mesh(beamG, beamM); b1.position.x = 0; beam.add(b1)
    const b2 = new THREE.Mesh(beamG, beamM); b2.rotation.y = Math.PI; beam.add(b2)
    const pl = new THREE.PointLight(PAL.lamp, 60, 45, 1.4); pl.position.y = 20; g.add(pl)
    // 灯台守の小屋
    const hut = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 })); hut.position.set(-3.5, 7.5, -2); g.add(hut)
    const hutRoof = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.5, 4.6), new THREE.MeshStandardMaterial({ color: PAL.snow, roughness: 1 })); hutRoof.position.set(-3.5, 9.2, -2); g.add(hutRoof)
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ color: 0xffbf6a })); win.position.set(-3.5, 7.6, -4.02); win.rotation.y = Math.PI; g.add(win)
    scene.add(g)
    out.lighthouse = g
    out.tick.push(t => { beam.rotation.y = t * 0.5 })
  }

  // ---- 奥の斜面を転がり落ちる巨大な雪玉（見せ場の飾り。当たりなし） ----
  {
    const slope = { x: 70, z0: 250, z1: 40, y0: 75, y1: -30 }
    const sg = new THREE.PlaneGeometry(70, Math.hypot(slope.z0 - slope.z1, slope.y0 - slope.y1), 20, 40)
    const pos = sg.attributes.position
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, Math.sin(x * 0.2 + y * 0.05) * 1.5 + Math.sin(y * 0.13) * 2) }
    sg.computeVertexNormals()
    const sm = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ map: M.snow.map, color: PAL.snow, roughness: 1 }))
    const ang = Math.atan2(slope.y0 - slope.y1, slope.z0 - slope.z1)
    sm.rotation.x = -Math.PI / 2 - ang + Math.PI
    sm.rotation.order = 'YXZ'
    sm.position.set(slope.x, (slope.y0 + slope.y1) / 2 - 3, (slope.z0 + slope.z1) / 2)
    sm.rotation.set(-(Math.PI / 2 - ang), 0, 0)
    scene.add(sm)
    const big = new THREE.Mesh(opt.ballGeo, M.ball); big.scale.setScalar(6); big.castShadow = false; scene.add(big)
    const puffT = opt.puffTex
    const puffs = []
    for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffT, color: 0xdfe6ff, transparent: true, opacity: 0, depthWrite: false })); scene.add(s); puffs.push({ s, t: 9 }) }
    let pi = 0, last = 0
    const P = 46
    out.tick.push((t, cam, player, dt) => {
      const ph = (t % P) / 14 // 14 秒で転がり落ちる
      const k = Math.min(1, ph)
      const r = 3 + k * 6
      const z = slope.z0 + (slope.z1 - slope.z0) * (k * k)
      const y = slope.y0 + (slope.y1 - slope.y0) * (k * k) + r
      big.visible = ph < 1
      big.position.set(slope.x - 8, y, z); big.scale.setScalar(r)
      big.rotation.x -= dt * (2 + k * 10) / r * 3
      if (ph < 1 && t - last > 0.12) {
        last = t; const pf = puffs[pi++ % puffs.length]; pf.t = 0; pf.s.position.set(big.position.x + (rnd() - 0.5) * r, y - r * 0.6, z + r * 0.8); pf.base = r * 1.6
      }
      for (const pf of puffs) { if (pf.t > 3) { pf.s.material.opacity = 0; continue } pf.t += dt; pf.s.scale.setScalar(pf.base * (1 + pf.t * 1.2)); pf.s.material.opacity = 0.5 * (1 - pf.t / 3); pf.s.position.y += dt * 1.5 }
    })
    out.bigBall = big
  }

  // ---- 遠くの玄武岩の島と凍った海 ----
  {
    const mR = new THREE.MeshStandardMaterial({ color: 0x2e3040, roughness: 1, flatShading: true })
    const mS = new THREE.MeshStandardMaterial({ color: 0xb8c0e8, roughness: 1, flatShading: true })
    const g = new THREE.CylinderGeometry(1, 1.15, 1, 6, 1)
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, R = 120 + rnd() * 320
      const x = Math.cos(a) * R, z = 100 + Math.sin(a) * R
      if (Math.abs(x - 70) < 45 && z > 20 && z < 270) continue // 巨大な雪玉の斜面を空ける
      const n = 3 + Math.floor(rnd() * 6), baseH = 20 + rnd() * 90, wid = 6 + rnd() * 16
      for (let j = 0; j < n; j++) {
        const h = baseH * (0.6 + rnd() * 0.5), ox = (rnd() - 0.5) * wid * 1.6, oz = (rnd() - 0.5) * wid * 1.6
        const col = new THREE.Mesh(g, mR); col.position.set(x + ox, -30 + h / 2, z + oz); col.scale.set(wid * 0.35, h, wid * 0.35); scene.add(col)
        const cap = new THREE.Mesh(g, mS); cap.position.set(x + ox, -30 + h + 0.6, z + oz); cap.scale.set(wid * 0.36, 1.4, wid * 0.36); scene.add(cap)
      }
    }
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600, 1, 1), new THREE.MeshStandardMaterial({ color: 0x3c4a7a, roughness: 0.35, metalness: 0.2 }))
    sea.rotation.x = -Math.PI / 2; sea.position.y = -30; scene.add(sea)
    // 浮氷
    const fl = new THREE.MeshStandardMaterial({ color: 0xc9d2f2, roughness: 0.6, flatShading: true })
    for (let i = 0; i < 120; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 5 + Math.floor(rnd() * 3)), fl); const a = rnd() * Math.PI * 2, R = 60 + rnd() * 260; m.position.set(Math.cos(a) * R, -29.6, 100 + Math.sin(a) * R); m.scale.set(4 + rnd() * 12, 0.8, 3 + rnd() * 10); m.rotation.y = rnd() * 6; scene.add(m) }
  }
  return out
}
