// glTF（埋め込み）から使うアニメだけ残して、詰め直した GLB を書く。
// node tools/slim.mjs <in.gltf> <out.glb> Idle,Walk,Run,...
import { readFileSync, writeFileSync } from 'node:fs'
const [, , inp, outp, keepS] = process.argv
const keep = new Set(keepS.split(','))
const j = JSON.parse(readFileSync(inp, 'utf8'))
const src = Buffer.from(j.buffers[0].uri.split(',')[1], 'base64')
j.animations = (j.animations || []).filter(a => keep.has(a.name))
// 指の骨と拡大の動きは外す（見えない・軽くする）
for (const a of j.animations) { const keepCh = a.channels.filter(c => c.target.path !== 'scale' && !/^(Index|Middle|Ring|Pinky|Thumb)/.test(j.nodes[c.target.node].name)); const ss = [...new Set(keepCh.map(c => c.sampler))]; a.samplers = ss.map(i => a.samplers[i]); for (const c of keepCh) c.sampler = ss.indexOf(c.sampler); a.channels = keepCh }
// 使われている accessor を集める
for (const m of j.meshes) for (const p of m.primitives) delete p.attributes.TEXCOORD_0 // 色は材質だけ。UV は使わない
const used = new Set()
for (const m of j.meshes) for (const p of m.primitives) {
  for (const k in p.attributes) used.add(p.attributes[k])
  if (p.indices != null) used.add(p.indices)
  for (const t of p.targets || []) for (const k in t) used.add(t[k])
}
for (const s of j.skins || []) if (s.inverseBindMatrices != null) used.add(s.inverseBindMatrices)
for (const a of j.animations) for (const s of a.samplers) { used.add(s.input); used.add(s.output) }
// 法線と重みは 8bit に詰める（法線 12→4 バイト、重み 16→4 バイト）
const quant = new Map()
for (const m of j.meshes) for (const p of m.primitives) { if (p.attributes.NORMAL != null) quant.set(p.attributes.NORMAL, 'n'); if (p.attributes.WEIGHTS_0 != null) quant.set(p.attributes.WEIGHTS_0, 'w') }
// accessor ごとに bufferView を新しく作り直す（1 accessor = 1 view）
const accMap = new Map(), newAcc = [], newViews = [], chunks = []
let off = 0
for (const i of [...used].sort((a, b) => a - b)) {
  const a = j.accessors[i], v = j.bufferViews[a.bufferView]
  const comp = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType]
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type]
  const stride = v.byteStride || comp * n
  const start = (v.byteOffset || 0) + (a.byteOffset || 0)
  const len = stride * (a.count - 1) + comp * n
  let data = src.subarray(start, start + len)
  let qa = null
  if (quant.has(i) && a.componentType === 5126) {
    const kind = quant.get(i), out = Buffer.alloc(a.count * 4)
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) {
      const f = data.readFloatLE(k * stride + c * 4)
      if (kind === 'n') out.writeInt8(Math.max(-127, Math.min(127, Math.round(f * 127))), k * 4 + c)
      else out.writeUInt8(Math.max(0, Math.min(255, Math.round(f * 255))), k * 4 + c)
    }
    data = out; qa = kind
  }
  const pad = (4 - (off % 4)) % 4
  if (pad) { chunks.push(Buffer.alloc(pad)); off += pad }
  const view = { buffer: 0, byteOffset: off, byteLength: data.length }
  if (qa) view.byteStride = 4
  else if (v.byteStride) view.byteStride = v.byteStride
  if (v.target) view.target = v.target
  chunks.push(data); off += data.length
  newViews.push(view)
  const na = { ...a, bufferView: newViews.length - 1 }; delete na.byteOffset
  if (qa) { na.componentType = qa === 'n' ? 5120 : 5121; na.normalized = true; delete na.min; delete na.max }
  accMap.set(i, newAcc.length); newAcc.push(na)
}
const M = i => accMap.get(i)
for (const m of j.meshes) for (const p of m.primitives) {
  for (const k in p.attributes) p.attributes[k] = M(p.attributes[k])
  if (p.indices != null) p.indices = M(p.indices)
  for (const t of p.targets || []) for (const k in t) t[k] = M(t[k])
}
for (const s of j.skins || []) if (s.inverseBindMatrices != null) s.inverseBindMatrices = M(s.inverseBindMatrices)
for (const a of j.animations) for (const s of a.samplers) { s.input = M(s.input); s.output = M(s.output) }
j.accessors = newAcc; j.bufferViews = newViews
let bin = Buffer.concat(chunks); const bp = (4 - (bin.length % 4)) % 4; if (bp) bin = Buffer.concat([bin, Buffer.alloc(bp)])
j.buffers = [{ byteLength: bin.length }]
let js = Buffer.from(JSON.stringify(j)); const jp = (4 - (js.length % 4)) % 4; if (jp) js = Buffer.concat([js, Buffer.alloc(jp, 0x20)])
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8)
const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b }
writeFileSync(outp, Buffer.concat([head, ch(js.length, 0x4E4F534A), js, ch(bin.length, 0x004E4942), bin]))
console.log(outp, (12 + 16 + js.length + bin.length) / 1024 | 0, 'KB', 'anims', j.animations.map(a => a.name).join(','))
