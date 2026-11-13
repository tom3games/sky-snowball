// 見た目。コースの箱（physics と同じデータ）からそのままメッシュを作る。
import * as THREE from 'three'
import { K } from './phys.js?v=4'
import { buildNight, PAL } from './night.js?v=4'
import { loadHero } from './hero.js?v=4'
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from '../vendor/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js'

const loader = new THREE.TextureLoader()
const TEX = {}
let aniso = 4
function tex(name, srgb) {
  const k = name + (srgb ? ':s' : '')
  if (TEX[k]) return TEX[k]
  const t = loader.load(`assets/tex/${name}.webp`, () => { View.loaded++ }, undefined, () => { View.loaded++ })
  View.toLoad++
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return (TEX[k] = t)
}

export const View = { loaded: 0, toLoad: 0 }

function mats() {
  const M = {}
  const snowT = { map: tex('snow_02_diff', true), normalMap: tex('snow_02_nor_gl'), roughnessMap: tex('snow_02_rough') }
  M.snow = new THREE.MeshStandardMaterial({ ...snowT, color: 0xeef2ff, roughness: 0.92, normalScale: new THREE.Vector2(0.45, 0.45) }); M.snow.userData.rep = 7
  M.cliff = new THREE.MeshStandardMaterial({ map: tex('rock_face_diff', true), normalMap: tex('rock_face_nor_gl'), color: 0x55566a, roughness: 0.85, normalScale: new THREE.Vector2(1.4, 1.4) }); M.cliff.userData.rep = 4
  M.rock = new THREE.MeshStandardMaterial({ map: tex('aerial_rocks_02_diff', true), normalMap: tex('aerial_rocks_02_nor_gl'), roughnessMap: tex('aerial_rocks_02_rough'), color: 0x4c4c5c, roughness: 0.85, normalScale: new THREE.Vector2(1.3, 1.3) }); M.rock.userData.rep = 3
  M.ice = new THREE.MeshStandardMaterial({ map: tex('snow_02_diff', true), normalMap: tex('snow_02_nor_gl'), color: 0x8fb0e8, roughness: 0.08, metalness: 0.1, normalScale: new THREE.Vector2(0.25, 0.25) }); M.ice.userData.rep = 6
  M.iceSide = new THREE.MeshStandardMaterial({ color: 0x4a6aa8, roughness: 0.2, metalness: 0.05 }); M.iceSide.userData.rep = 4
  M.plank = new THREE.MeshStandardMaterial({ map: tex('rock_boulder_dry_diff', true), normalMap: tex('rock_boulder_dry_nor_gl') })
  M.ball = new THREE.MeshStandardMaterial({ ...snowT, color: 0xeef0ff, roughness: 0.85, normalScale: new THREE.Vector2(1.2, 1.2) })
  return M
}

// 面ごとに、箱の大きさに合わせて UV を広げる（模様の大きさをそろえる）
function scaleUV(geo, w, h, d, reps) {
  const uv = geo.attributes.uv
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++) {
    const [a, b] = dims[f], rep = reps[f]
    for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * a / rep, uv.getY(k) * b / rep) }
  }
  uv.needsUpdate = true
}

export function buildView(W, host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  // スマホは軽くする（解像度 1.5 倍まで・影 1024・ブルームは 1/4）
  const mobile = matchMedia('(pointer: coarse)').matches
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2)
  renderer.setPixelRatio(dpr)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  host.appendChild(renderer.domElement)
  aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy())

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(new THREE.Color(PAL.fog), 0.0085)
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1500)
  // 後処理: ランタンと灯台の光をにじませる
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.55, 0.86)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  // 降る雪（カメラのまわり 40m の箱の中をくり返す）
  const NS = 1600, sPos = new Float32Array(NS * 3)
  for (let i = 0; i < NS; i++) { sPos[i * 3] = (Math.random() - 0.5) * 40; sPos[i * 3 + 1] = Math.random() * 30; sPos[i * 3 + 2] = (Math.random() - 0.5) * 40 }
  const snowG = new THREE.BufferGeometry(); snowG.setAttribute('position', new THREE.BufferAttribute(sPos, 3))
  const snowM = new THREE.PointsMaterial({ color: 0xe8ecff, size: 0.06, transparent: true, opacity: 0.8, depthWrite: false })
  const snowPts = new THREE.Points(snowG, snowM); snowPts.frustumCulled = false; scene.add(snowPts)
  function fall(dt, cam) {
    const a = snowG.attributes.position.array, t = performance.now() / 1000
    for (let i = 0; i < NS; i++) {
      let x = a[i * 3], y = a[i * 3 + 1], z = a[i * 3 + 2]
      y -= dt * (0.7 + (i % 5) * 0.12); x += Math.sin(t * 0.7 + i) * dt * 0.3
      const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z
      if (y < cy - 12) y += 30; if (y > cy + 18) y -= 30
      if (x < cx - 20) x += 40; if (x > cx + 20) x -= 40
      if (z < cz - 20) z += 40; if (z > cz + 20) z -= 40
      a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z
    }
    snowG.attributes.position.needsUpdate = true
  }

  const hemi = new THREE.HemisphereLight(0x9aa6d8, 0x2a2a38, 1.5); scene.add(hemi)
  // 月とオーロラの光（青白い）
  const sun = new THREE.DirectionalLight(0xa9b6ff, 2.6)
  sun.position.set(-30, 50, -20); sun.castShadow = true
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048)
  const sc = sun.shadow.camera; sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 160
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03
  scene.add(sun); scene.add(sun.target)

  const M = mats()
  // コースの箱
  const boxMeshes = new Map()
  for (const b of W.boxes) {
    if (b.prop) continue
    const w = b.h.x * 2, h = b.h.y * 2, d = b.h.z * 2
    const geo = new THREE.BoxGeometry(w, h, d)
    let mm
    if (b.mat === 'snow') mm = [M.cliff, M.cliff, M.snow, M.cliff, M.cliff, M.cliff]
    else if (b.mat === 'ice') mm = [M.iceSide, M.iceSide, M.ice, M.iceSide, M.iceSide, M.iceSide]
    else mm = [M.rock, M.rock, M.rock, M.rock, M.rock, M.rock]
    if (b.breakable) { const im = new THREE.MeshStandardMaterial({ color: 0x9cc2f0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.82, emissive: 0x1a2a50 }); im.userData.rep = 4; mm = [im, im, im, im, im, im] }
    if (b.gate) { const gm = new THREE.MeshStandardMaterial({ map: M.plank.map, normalMap: M.plank.normalMap, color: 0x8a6a50, roughness: 0.85 }); gm.userData.rep = 2; mm = [gm, gm, gm, gm, gm, gm] }
    if (b.plate) { const pm = new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.4, metalness: 0.7, emissive: 0x000000 }); pm.userData.rep = 1; mm = [pm, pm, pm, pm, pm, pm]; b._plateMat = pm }
    scaleUV(geo, w, h, d, mm.map(m => m.userData.rep))
    const mesh = new THREE.Mesh(geo, mm)
    mesh.position.set(b.c.x, b.c.y, b.c.z)
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(b.ax.x, b.ax.y, b.ax.z), new THREE.Vector3(b.ay.x, b.ay.y, b.ay.z), new THREE.Vector3(b.az.x, b.az.y, b.az.z)))
    mesh.castShadow = h < 20; mesh.receiveShadow = true
    scene.add(mesh); boxMeshes.set(b, mesh)
  }
  // 日なた・深い雪の印
  const zoneMeshes = []
  for (const z of W.zones) {
    if (z.kind === 'sun') {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(z.x1 - z.x0, z.z1 - z.z0), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }))
      m.rotation.x = -Math.PI / 2; m.position.set((z.x0 + z.x1) / 2, z.y0 + 1.04, (z.z0 + z.z1) / 2); scene.add(m); zoneMeshes.push({ z, m })
    }
    if (z.kind === 'deep') {
      // ふかふかの新雪（見た目だけ。人は腰まで埋まって見える）
      const geo = new THREE.PlaneGeometry(z.x1 - z.x0, z.z1 - z.z0, 48, 120)
      const pos = geo.attributes.position
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, 0.05 * Math.sin(x * 2.1 + y * 0.7) + 0.06 * Math.sin(y * 1.3 - x * 0.4)) }
      geo.computeVertexNormals()
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: M.snow.map }))
      const ang = Math.atan2(z.y1 - 3 - (z.y0 + 2), z.z1 - z.z0)
      m.rotation.x = -Math.PI / 2 + 4 * Math.PI / 180
      m.position.set((z.x0 + z.x1) / 2, (z.y1 - 3 + z.y0 + 2) / 2 + 0.45, (z.z0 + z.z1) / 2)
      m.receiveShadow = true; scene.add(m)
    }
  }
  // 吹雪の粒
  const windZ = W.zones.filter(z => z.kind === 'wind')
  const flakes = new THREE.BufferGeometry()
  const NF = 900, fpos = new Float32Array(NF * 3)
  for (let i = 0; i < NF; i++) { fpos[i * 3] = Math.random(); fpos[i * 3 + 1] = Math.random(); fpos[i * 3 + 2] = Math.random() }
  flakes.setAttribute('position', new THREE.BufferAttribute(fpos.slice(), 3))
  const flakeMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false })
  const flakePts = new THREE.Points(flakes, flakeMat); flakePts.frustumCulled = false; scene.add(flakePts)

  // 旗（黄ばんだ布）
  const flagObjs = W.flags.map((f, i) => {
    const g = new THREE.Group(); g.position.set(f.x + 1.4, f.y, f.z + 0.9)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x5a4c3e, roughness: 0.8 }))
    pole.position.y = 1.3; pole.castShadow = true; g.add(pole)
    const cg = new THREE.PlaneGeometry(0.95, 0.5, 10, 4); cg.translate(0.475, 0, 0)
    // 燕尾（先を V に切る）: 先端側の真ん中の頂点を内側へ寄せる
    { const a = cg.attributes.position; for (let k = 0; k < a.count; k++) { const x = a.getX(k), y = a.getY(k); const w = x / 0.95; a.setX(k, x - (1 - Math.abs(y) / 0.25) * 0.28 * w * w); a.setY(k, y * (1 - 0.35 * w)) } }
    const cloth = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: 0xcdb46a, roughness: 0.95, side: THREE.DoubleSide }))
    cloth.position.y = 2.2; cloth.castShadow = true; g.add(cloth)
    const cairn = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 0), M.rock); cairn.position.y = 0.15; cairn.scale.set(1.2, 0.6, 1.1); g.add(cairn)
    scene.add(g)
    return { g, cloth, base: cg.attributes.position.array.slice() }
  })

  // 雪玉
  const ballGeo = new THREE.SphereGeometry(1, 40, 28)
  // 表面に雪の塊のでこぼこ
  { const p = ballGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + 0.028 * Math.sin(x * 9 + y * 4) * Math.sin(z * 7 - y * 5) + 0.018 * Math.sin(x * 23 + z * 17); p.setXYZ(i, x * k, y * k, z * k) } ballGeo.computeVertexNormals() }
  const ballMeshes = new Map()
  const puffTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t })()
  const night = buildNight(scene, W, M, { ballGeo, puffTex, onFog: c => { scene.fog.color.copy(c); View.fog = '#' + c.getHexString() } })
  // 転がった跡（雪がはがれて少し暗い帯）
  const NT = 2400
  const trackGeo = new THREE.PlaneGeometry(1, 1); trackGeo.rotateX(-Math.PI / 2)
  const grooveTex = (() => {
    // 横断面: 両端に押し出された雪の明るい盛り上がり、真ん中は押し固められて暗い
    const c = document.createElement('canvas'); c.width = 64; c.height = 4
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 64, 0)
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.1, 'rgba(250,252,255,0.85)'); gr.addColorStop(0.22, 'rgba(150,160,205,0.75)')
    gr.addColorStop(0.5, 'rgba(120,128,180,0.8)'); gr.addColorStop(0.78, 'rgba(150,160,205,0.75)'); gr.addColorStop(0.9, 'rgba(250,252,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 64, 4)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  })()
  const trackMat = new THREE.MeshStandardMaterial({ map: grooveTex, color: 0xffffff, roughness: 0.9, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
  const tracks = new THREE.InstancedMesh(trackGeo, trackMat, NT); tracks.count = 0; tracks.receiveShadow = true; tracks.frustumCulled = false
  scene.add(tracks)
  let trackI = 0
  // 足跡
  const NP = 700
  const printTex = (() => { const c = document.createElement('canvas'); c.width = 32; c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 34, 2, 16, 34, 16); gr.addColorStop(0, 'rgba(110,118,170,0.85)'); gr.addColorStop(1, 'rgba(110,118,170,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(16, 30, 11, 24, 0, 0, Math.PI * 2); g.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t })()
  const prints = new THREE.InstancedMesh(trackGeo, new THREE.MeshStandardMaterial({ map: printTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, roughness: 1 }), NP)
  prints.count = 0; prints.frustumCulled = false; scene.add(prints)
  let printI = 0, printD = 0, printSide = 1
  function footprints(p, dt) {
    if (!p.ground || p.gBall || p.gmat !== 'snow' || p.mantle) return
    printD += Math.hypot(p.vel.x, p.vel.z) * dt
    if (printD < 0.62) return
    printD = 0; printSide = -printSide
    const rx = Math.cos(p.yaw) * 0.13 * printSide, rz = -Math.sin(p.yaw) * 0.13 * printSide
    _p.set(p.pos.x + rx, p.pos.y + 0.012, p.pos.z + rz)
    _q.setFromUnitVectors(_up, new THREE.Vector3(p.gn.x, p.gn.y, p.gn.z)); _q.multiply(new THREE.Quaternion().setFromAxisAngle(_up, p.yaw))
    _m4.compose(_p, _q, _s.set(0.16, 1, 0.3))
    prints.setMatrixAt(printI, _m4); printI = (printI + 1) % NP; prints.count = Math.max(prints.count, printI === 0 ? NP : printI); prints.instanceMatrix.needsUpdate = true
  }
  const lastTrack = new Map()
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0)

  // 人（灰色の試作: 胴・頭・帽子・マフラー・手足を手続きで動かす）
  const hero = new THREE.Group(); scene.add(hero)
  const H = loadHero(scene)
  const coat = new THREE.MeshStandardMaterial({ color: 0x55606c, roughness: 0.9 })
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9b8a0, roughness: 0.7 })
  const hat = new THREE.MeshStandardMaterial({ color: 0x9a3b2a, roughness: 0.9 })
  const scarfM = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.9 })
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.55, 6, 12), coat); torso.position.y = 1.05; torso.castShadow = true
  const pelvis = new THREE.Group(); pelvis.position.y = 0.72; hero.add(pelvis)
  const upper = new THREE.Group(); upper.position.y = 0.0; pelvis.add(upper)
  torso.position.y = 0.36; upper.add(torso)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 14), skin); head.position.y = 0.95; head.castShadow = true; upper.add(head)
  const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.225, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hat); beanie.position.y = 0.99; upper.add(beanie)
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), hat); pom.position.y = 1.22; upper.add(pom)
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.065, 8, 16), scarfM); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.74; upper.add(scarf)
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.04), scarfM); tail.position.set(0.1, 0.55, -0.22); upper.add(tail)
  const limb = (r, l, m) => { const g = new THREE.Group(); const me = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 8), m); me.position.y = -l / 2 - r * 0.5; me.castShadow = true; g.add(me); return g }
  const armL = limb(0.085, 0.5, coat), armR = limb(0.085, 0.5, coat)
  armL.position.set(0.36, 0.68, 0); armR.position.set(-0.36, 0.68, 0); upper.add(armL, armR)
  const legL = limb(0.11, 0.48, new THREE.MeshStandardMaterial({ color: 0x3c4148, roughness: 0.9 })), legR = limb(0.11, 0.48, legL.children[0].material)
  legL.position.set(0.14, 0, 0); legR.position.set(-0.14, 0, 0); pelvis.add(legL, legR)
  // 足元の丸い影（どこに降りるかを見せる）
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x1a2430, transparent: true, opacity: 0.32, depthWrite: false }))
  blob.rotation.x = -Math.PI / 2; scene.add(blob)
  // 置く先の印（重ねる時）
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }))
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring)

  const shardGeo = new THREE.TetrahedronGeometry(0.35)
  const shardMat = new THREE.MeshStandardMaterial({ color: 0xaecdf5, roughness: 0.05, transparent: true, opacity: 0.85 })
  const shards = []
  function shatter(e, W) {
    const b = W.boxes.find(x => x.id === e.id); if (!b) return
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(shardGeo, shardMat); m.scale.setScalar(0.4 + Math.random() * 1.4)
      m.position.set(b.min.x + Math.random() * (b.max.x - b.min.x), b.min.y + Math.random() * (b.max.y - b.min.y), b.c.z)
      scene.add(m)
      shards.push({ m, t: 0, w: (Math.random() - 0.5) * 12, floor: b.min.y + 0.1, v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 5, 3 + Math.random() * 6) })
    }
  }
  let walkPh = 0
  const camState = { yaw: Math.PI, pitch: 0.46, dist: 7.6, tgt: new THREE.Vector3(), cur: new THREE.Vector3(), auto: 0 }

  function resize() {
    const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w / (mobile ? 4 : 2), h / (mobile ? 4 : 2)); camera.aspect = w / h
    camera.fov = w < h ? 68 : 55
    camState.dist = w < h ? 8.8 : 7.6
    camera.updateProjectionMatrix()
  }
  addEventListener('resize', resize); resize()

  function syncBalls(W, dt) {
    const alive = new Set()
    for (const b of W.balls) {
      alive.add(b.id)
      let m = ballMeshes.get(b.id)
      if (!m) { m = new THREE.Mesh(ballGeo, M.ball); m.castShadow = true; m.receiveShadow = true; scene.add(m); ballMeshes.set(b.id, m) }
      m.position.set(b.pos.x, b.pos.y, b.pos.z)
      // 溶けている玉は少しつやが出て沈む
      m.scale.setScalar(b.r)
      m.quaternion.set(b.spin.x, b.spin.y, b.spin.z, b.spin.w)
      // 跡
      if (b.ground && b.gmat === 'snow') {
        const lt = lastTrack.get(b.id)
        const dx = lt ? b.pos.x - lt.x : 1, dz = lt ? b.pos.z - lt.z : 1
        if (!lt || dx * dx + dz * dz > 0.09) {
          const gy = b.pos.y - b.r * b.gn.y
          _p.set(b.pos.x - b.gn.x * b.r, gy + 0.015, b.pos.z - b.gn.z * b.r)
          _q.setFromUnitVectors(_up, new THREE.Vector3(b.gn.x, b.gn.y, b.gn.z))
          const yaw = Math.atan2(dx, dz)
          _q.multiply(new THREE.Quaternion().setFromAxisAngle(_up, yaw))
          _s.set(b.r * 1.5, 1, lt ? Math.min(0.6, Math.hypot(dx, dz) + 0.08) : 0.3)
          _m4.compose(_p, _q, _s)
          tracks.setMatrixAt(trackI, _m4); trackI = (trackI + 1) % NT; tracks.count = Math.max(tracks.count, trackI === 0 ? NT : trackI)
          tracks.instanceMatrix.needsUpdate = true
          lastTrack.set(b.id, { x: b.pos.x, z: b.pos.z })
        }
      } else lastTrack.delete(b.id)
    }
    for (const [id, m] of ballMeshes) if (!alive.has(id)) { scene.remove(m); ballMeshes.delete(id) }
  }

  function poseHero(W, dt, extra) {
    const p = W.p
    hero.position.set(p.pos.x, p.pos.y, p.pos.z)
    if (p.deep) hero.position.y -= 0.35
    hero.rotation.y = p.yaw
    if (H.ready) {
      hero.visible = false
      H.root.position.copy(hero.position); H.root.rotation.y = p.yaw
      H.update(p, dt, W.t)
    }
    const sp = Math.hypot(p.vel.x, p.vel.z)
    walkPh += dt * (2.2 + sp * 2.1)
    const sw = p.ground ? Math.min(1, sp / 3.5) : 0.3
    const s = Math.sin(walkPh)
    legL.rotation.x = s * 0.7 * sw; legR.rotation.x = -s * 0.7 * sw
    let aL = -s * 0.5 * sw, aR = s * 0.5 * sw, lean = sp * 0.03
    if (p.push && !p.push.stuck) { aL = aR = -1.35; lean = 0.38 }
    else if (p.push && p.push.stuck) { aL = aR = -1.4; lean = 0.45 + Math.sin(W.t * 30) * 0.03 }
    if (p.hold) { aL = aR = -2.6; lean = -0.05 }
    if (p.mantle) { const k = Math.min(1, p.mantle.t / K.mantleT); aL = aR = -2.9 + k * 1.6; lean = 0.5 - k * 0.3; legL.rotation.x = -0.9 * (1 - k); legR.rotation.x = -0.3 }
    if (!p.ground && !p.mantle) { aL = aR = -1.9; legL.rotation.x = -0.5; legR.rotation.x = 0.3 }
    if (p.gBall && p.ground) { armL.rotation.z = 1.2; armR.rotation.z = -1.2; aL = aR = -0.2 } else { armL.rotation.z = 0.08; armR.rotation.z = -0.08 }
    armL.rotation.x = aL; armR.rotation.x = aR
    upper.rotation.x = lean
    pelvis.position.y = 0.72 + (p.ground ? Math.abs(Math.cos(walkPh)) * 0.04 * sw : 0)
    tail.rotation.x = 0.3 + sp * 0.12 + Math.sin(W.t * 7) * 0.08
    // 丸い影
    blob.visible = !p.ground || p.gBall
    if (blob.visible) {
      let gy = extra.groundY
      blob.position.set(p.pos.x, (gy ?? p.pos.y - 50) + 0.03, p.pos.z)
      blob.visible = gy != null
      const h = p.pos.y - (gy ?? 0); blob.scale.setScalar(Math.max(0.35, 1 - h * 0.08))
    }
  }

  function updateFX(W, dt) {
    for (const zm of zoneMeshes) {
      const ph = zm.z.period ? ((W.t + (zm.z.phase || 0)) % zm.z.period) : 0
      const on = !zm.z.period || ph < zm.z.on
      const target = on ? 0.22 : 0.0
      zm.m.material.opacity += (target - zm.m.material.opacity) * Math.min(1, dt * 3)
      // 湯気: 割れ目から吹き上がる
      if (!zm.steam) {
        zm.steam = []; zm.vents = []
        const z = zm.z
        for (let zz = z.z0 + 1.5; zz < z.z1 - 0.5; zz += 3) for (let xx = z.x0 + 1.5; xx < z.x1 - 0.5; xx += 3.4) zm.vents.push([xx + Math.sin(zz * 3.1) * 0.8, z.y0 + 1, zz + Math.cos(xx * 2.3) * 0.6])
        const crackM = new THREE.MeshBasicMaterial({ color: 0x2a2018, transparent: true, opacity: 0.7, depthWrite: false })
        for (const [x, y, zz] of zm.vents) { const c = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.18), crackM); c.rotation.x = -Math.PI / 2; c.rotation.z = Math.sin(x * 7) * 1.2; c.position.set(x, y + 0.02, zz); scene.add(c) }
        for (let i = 0; i < 70; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: 0xffd6b0, transparent: true, opacity: 0, depthWrite: false })); scene.add(sp); zm.steam.push({ sp, t: 9, base: 1 }) }
        zm.k = 0; zm.acc = 0
      }
      zm.acc += dt
      if (on && zm.acc > 0.05) { zm.acc = 0; const v = zm.vents[zm.k % zm.vents.length]; const pf = zm.steam[zm.k++ % zm.steam.length]; pf.t = 0; pf.sp.position.set(v[0], v[1] + 0.2, v[2]); pf.base = 0.8 + Math.random() * 0.6 }
      for (const pf of zm.steam) { if (pf.t > 2.4) { pf.sp.material.opacity = 0; continue } pf.t += dt; pf.sp.position.y += dt * 2.2; pf.sp.scale.setScalar(pf.base * (1 + pf.t * 1.6)); pf.sp.material.opacity = 0.42 * Math.sin(Math.min(1, pf.t / 2.4) * Math.PI) }
    }
    // 旗をなびかせる
    flagObjs.forEach((fo, i) => {
      const lit = W.flags[i].lit, a = fo.cloth.geometry.attributes.position
      for (let k = 0; k < a.count; k++) {
        const bx = fo.base[k * 3], by = fo.base[k * 3 + 1]
        const w = bx / 0.95
        a.setZ(k, Math.sin(W.t * (lit ? 6 : 3) + bx * 5 + by) * 0.12 * w)
        a.setY(k, by - w * (lit ? 0.04 : 0.18))
      }
      a.needsUpdate = true
      fo.cloth.material.color.setHex(lit ? 0xd9b34a : 0x9a8a58)
    })
    // 吹雪
    const wz = windZ[0]
    if (wz) {
      const ph = (W.t + (wz.phase || 0)) % wz.period, on = ph < wz.on
      const pa = flakes.attributes.position
      for (let i = 0; i < NF; i++) {
        let x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i)
        if (x === 0 && y === 0) { }
        const sp = on ? 14 : 1.2
        x += sp * dt * (0.6 + (i % 7) * 0.08); y += (on ? -0.6 : -1) * dt
        if (x > wz.x1 + 6 || y < wz.y0 || x < wz.x0 - 8 || x > 999) { x = wz.x0 - 6 - Math.random() * 3; y = wz.y0 + 1 + Math.random() * 7; z = wz.z0 + Math.random() * (wz.z1 - wz.z0) }
        if (x < 1 && y < 1 && z < 1) { x = wz.x0 + Math.random() * (wz.x1 - wz.x0); y = wz.y0 + 1 + Math.random() * 7; z = wz.z0 + Math.random() * (wz.z1 - wz.z0) }
        pa.setXYZ(i, x, y, z)
      }
      pa.needsUpdate = true
      flakeMat.size = on ? 0.11 : 0.07
    }
    for (const [b, m] of boxMeshes) if (m.visible !== b.on) m.visible = b.on
    for (const [b, m] of boxMeshes) { if (b.gate) m.position.y = b.c.y; if (b._plateMat) b._plateMat.emissive.setHex(b.pressed ? 0x7a4a10 : 0x000000) }
    // 氷のかけら
    for (const sh of shards) { if (sh.t > 2.5) { sh.m.visible = false; continue } sh.t += dt; sh.v.y -= 20 * dt; sh.m.position.addScaledVector(sh.v, dt); sh.m.rotation.x += sh.w * dt; sh.m.rotation.z += sh.w * dt * 0.7; if (sh.m.position.y < sh.floor) { sh.m.position.y = sh.floor; sh.v.multiplyScalar(0.3); sh.v.y = Math.abs(sh.v.y) * 0.2 } }
  }

  return {
    renderer, scene, camera, camState, sun, ring, night, hero: H, shatter,
    render(W, dt, extra) {
      syncBalls(W, dt); poseHero(W, dt, extra); updateFX(W, dt); footprints(W.p, Math.min(dt, 0.1))
      // 影の箱を人について動かす
      const p = W.p.pos
      sun.position.set(p.x - 26, p.y + 26, p.z - 34); sun.target.position.set(p.x, p.y, p.z)
      const rt = performance.now() / 1000
      for (const f of night.tick) f(rt, camera, W.p.pos, dt)
      fall(Math.min(dt, 0.05), camera)
      composer.render()
    },
    resize,
  }
}
