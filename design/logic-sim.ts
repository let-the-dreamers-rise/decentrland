import { buildTrack, project, accumulate, positionAt } from '../src/shared/track'
import { encodePath, decodePath } from '../src/shared/codec'
import * as C from '../src/shared/config'

let fails = 0
const check = (name: string, ok: boolean, extra = '') => {
  if (!ok) { fails++; console.log('FAIL', name, extra) } else console.log('ok  ', name, extra)
}

const track = buildTrack(20345)

// --- geometry sanity
check('loop length is plausible for a 64m scene', track.length > 100 && track.length < 220, `len=${track.length.toFixed(1)}m`)
let inBounds = track.points.every(p => p.x > 2 && p.x < 62 && p.z > 2 && p.z < 62)
check('every track point is inside the scene', inBounds)
check('obstacles are inside the scene', track.obstacles.every(p => p.x > 0 && p.x < 64 && p.z > 0 && p.z < 64))

// --- projection lands on the line
let maxOffset = 0
for (let d = 0; d < track.length; d += 0.5) {
  const p = positionAt(track, d)
  maxOffset = Math.max(maxOffset, project(track, p.x, p.z).offset)
}
check('points on the line project with ~0 offset', maxOffset < 0.05, `max=${maxOffset.toFixed(4)}`)

// --- a full lap accumulates to the loop length, including the start-line wrap
let metres = 0
let prev = project(track, positionAt(track, 0).x, positionAt(track, 0).z).progress
for (let d = 0; d <= track.length; d += 0.25) {
  const p = positionAt(track, d)
  const cur = project(track, p.x, p.z).progress
  metres += Math.max(0, accumulate(prev, cur, track.length))
  prev = cur
}
check('one lap accumulates to the loop length', Math.abs(metres - track.length) < 1.5, `got=${metres.toFixed(2)} want=${track.length.toFixed(2)}`)

// --- three laps, no wraparound blow-up
let m3 = 0; prev = project(track, positionAt(track,0).x, positionAt(track,0).z).progress
for (let d = 0; d <= track.length * 3; d += 0.25) {
  const p = positionAt(track, d)
  const cur = project(track, p.x, p.z).progress
  m3 += Math.max(0, accumulate(prev, cur, track.length))
  prev = cur
}
check('three laps accumulate cleanly (no wrap spikes)', Math.abs(m3 - track.length * 3) < 4, `got=${m3.toFixed(1)}`)

// --- running backwards never scores
let back = 0; prev = project(track, positionAt(track, track.length).x, positionAt(track, track.length).z).progress
for (let d = track.length; d >= 0; d -= 0.25) {
  const p = positionAt(track, d)
  const cur = project(track, p.x, p.z).progress
  back += Math.max(0, accumulate(prev, cur, track.length))
  prev = cur
}
check('running the loop backwards scores ~nothing', back < 2, `got=${back.toFixed(2)}`)

// --- cutting the middle is off-track
check('the centre of the arena is off the racing line', project(track, C.CENTER.x, C.CENTER.z).offset > C.TRACK_WIDTH, `offset=${project(track,C.CENTER.x,C.CENTER.z).offset.toFixed(1)}`)

// --- codec round-trip within a decimetre
const samples = []
for (let i = 0; i < C.MAX_SAMPLES; i++) {
  const p = positionAt(track, (i / C.SAMPLE_HZ) * 6)
  samples.push({ x: p.x, y: 1.2 + Math.sin(i) * 0.4, z: p.z })
}
const encoded = encodePath(samples)
const decoded = decodePath(encoded)
let maxErr = 0
for (let i = 0; i < samples.length; i++) {
  maxErr = Math.max(maxErr, Math.abs(samples[i].x - decoded[i].x), Math.abs(samples[i].y - decoded[i].y), Math.abs(samples[i].z - decoded[i].z))
}
check('codec round-trips within 5 cm', maxErr <= 0.05, `err=${maxErr.toFixed(3)}m`)
check('sample count survives the round trip', decoded.length === samples.length)
check('a ghost fits well inside the 13KB message cap', encoded.length < 4000, `${encoded.length} bytes for ${C.RUN_SECONDS}s`)
check('a full roster fits in storage-sized chunks', encoded.length * C.MAX_GHOSTS < 100000, `${(encoded.length*C.MAX_GHOSTS/1024).toFixed(0)}KB total`)

// --- overtake detection: fast runner vs slow ghost
function ghostMetres(speed: number) {
  const out: number[] = []
  for (let i = 0; i < C.MAX_SAMPLES; i++) out.push((i / C.SAMPLE_HZ) * speed)
  return out
}
const slow = ghostMetres(4)
const fast = ghostMetres(8)
let overtakes = 0, ahead = [false, false]
const rosters = [slow, fast]
for (let i = 0; i < C.MAX_SAMPLES; i++) {
  const me = (i / C.SAMPLE_HZ) * 6   // 6 m/s: faster than slow, slower than fast
  rosters.forEach((g, k) => {
    const gm = g[i]
    if (!ahead[k] && me > gm + 1.5) { ahead[k] = true; overtakes++ }
    else if (ahead[k] && me < gm - 1.5) ahead[k] = false
  })
}
check('a 6 m/s run passes the 4 m/s ghost exactly once', overtakes === 1, `overtakes=${overtakes}`)
check('and never passes the 8 m/s ghost', ahead[1] === false)

// --- hysteresis: a runner pacing a ghost exactly does not flap
let flaps = 0, a = false
for (let i = 0; i < C.MAX_SAMPLES; i++) {
  const gm = (i / C.SAMPLE_HZ) * 6
  const me = gm + Math.sin(i * 0.7) * 1.2   // jitters +/-1.2m, inside the 1.5m band
  if (!a && me > gm + 1.5) { a = true; flaps++ }
  else if (a && me < gm - 1.5) a = false
}
check('pacing a ghost within the deadband does not flap', flaps === 0, `flaps=${flaps}`)

// --- daily variation
const t2 = buildTrack(20346)
let same = 0
for (let i = 0; i < track.points.length; i++) {
  if (Math.abs(track.points[i].x - t2.points[i].x) < 0.01) same++
}
check('the track changes shape day to day', same < track.points.length / 4, `identical points=${same}`)

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
