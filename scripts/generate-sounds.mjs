// Generates the app's Halloween sound effects as small 16-bit mono WAV files in public/sounds/.
// Synthesised from scratch, so they're free to use. Run: node scripts/generate-sounds.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

const RATE = 22050

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2))
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

const buffer = (secs) => new Float32Array(Math.floor(secs * RATE))

function normalise(out, peak = 0.85) {
  const max = out.reduce((m, s) => Math.max(m, Math.abs(s)), 0) || 1
  for (let i = 0; i < out.length; i++) out[i] = (out[i] / max) * peak
  return out
}

/** Adds a tone into `out` starting at `start` seconds. */
function tone(out, { start, dur, freq, freqEnd = freq, vol = 0.5, shape = 'sine', attack = 0.005, vibrato = 0, vibratoRate = 6 }) {
  let phase = 0
  const n = Math.floor(dur * RATE)
  const offset = Math.floor(start * RATE)
  for (let i = 0; i < n && offset + i < out.length; i++) {
    const t = i / n
    const f = (freq + (freqEnd - freq) * t) * (1 + vibrato * Math.sin((2 * Math.PI * vibratoRate * i) / RATE))
    phase += (2 * Math.PI * f) / RATE
    const raw =
      shape === 'square' ? Math.sign(Math.sin(phase)) * 0.6
      : shape === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(phase))
      : shape === 'saw' ? ((phase / Math.PI) % 2) - 1
      : Math.sin(phase)
    const env = Math.min(1, i / (attack * RATE)) * (1 - t) ** 1.2
    out[offset + i] += raw * env * vol
  }
}

// Creaky door (spin): stick-slip clicks whose rate wobbles, each ringing a couple of wood resonances.
const creak = buffer(0.75)
{
  let t = 0.02
  while (t < 0.7) {
    const u = t / 0.7
    const rate = 28 + 45 * Math.sin(Math.PI * u) + 8 * Math.sin(u * 23) // clicks per second
    const amp = Math.sin(Math.PI * u) ** 0.6
    const start = Math.floor(t * RATE)
    for (let i = 0; i < RATE * 0.02 && start + i < creak.length; i++) {
      const s = i / RATE
      const ring = Math.exp(-s * 260) * (Math.sin(2 * Math.PI * 640 * s) + 0.6 * Math.sin(2 * Math.PI * 1480 * s))
      creak[start + i] += ring * amp
    }
    t += 1 / rate
  }
  normalise(creak, 0.7)
}

// Low groan (loss): a wavering low sawtooth through a simple low-pass filter.
const groan = buffer(1.0)
{
  tone(groan, { start: 0, dur: 1.0, freq: 98, freqEnd: 68, vol: 0.8, shape: 'saw', attack: 0.15, vibrato: 0.03, vibratoRate: 5 })
  tone(groan, { start: 0, dur: 1.0, freq: 147, freqEnd: 104, vol: 0.3, shape: 'saw', attack: 0.2, vibrato: 0.03, vibratoRate: 4 })
  let y = 0
  for (let i = 0; i < groan.length; i++) groan[i] = y += 0.07 * (groan[i] - y)
  normalise(groan, 0.8)
}

// Witch cackle (big win): quick falling "heh-heh-heh" syllables with a breathy edge, then a long "haaa".
const cackle = buffer(1.35)
{
  const syllables = 7
  for (let k = 0; k < syllables; k++) {
    const start = 0.03 + k * 0.115
    const pitch = 980 - k * 45
    tone(cackle, { start, dur: 0.08, freq: pitch * 1.06, freqEnd: pitch * 0.92, vol: 0.5, shape: 'square', attack: 0.004, vibrato: 0.04, vibratoRate: 32 })
    tone(cackle, { start, dur: 0.08, freq: pitch * 2.1, freqEnd: pitch * 1.9, vol: 0.15, attack: 0.004 })
  }
  tone(cackle, { start: 0.85, dur: 0.48, freq: 820, freqEnd: 520, vol: 0.5, shape: 'square', attack: 0.01, vibrato: 0.05, vibratoRate: 26 })
  for (let i = 0; i < cackle.length; i++) cackle[i] += (Math.random() * 2 - 1) * 0.06 * Math.abs(cackle[i])
  let y = 0
  for (let i = 0; i < cackle.length; i++) cackle[i] = y += 0.35 * (cackle[i] - y)
  normalise(cackle, 0.75)
}

// Win: an eerie minor arpeggio (A minor) with a shimmer on top.
const win = buffer(0.8)
;[440, 523, 659].forEach((f, i) => tone(win, { start: i * 0.08, dur: 0.16, freq: f, vol: 0.45, shape: 'triangle', vibrato: 0.006 }))
tone(win, { start: 0.24, dur: 0.55, freq: 880, vol: 0.5, shape: 'triangle', vibrato: 0.01, vibratoRate: 7 })
tone(win, { start: 0.24, dur: 0.45, freq: 1319, vol: 0.12 })
normalise(win, 0.8)

mkdirSync('public/sounds', { recursive: true })
for (const [name, samples] of Object.entries({ spin: creak, win, lose: groan, bigwin: cackle })) {
  writeFileSync(`public/sounds/${name}.wav`, wav(samples))
}
console.log('Wrote public/sounds/{spin,win,lose,bigwin}.wav')
