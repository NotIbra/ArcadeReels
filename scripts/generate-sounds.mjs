// Generates the app's sound effects as tiny 16-bit mono WAV files in public/sounds/.
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

/** Adds a tone into `out` starting at `start` seconds. */
function tone(out, { start, dur, freq, freqEnd = freq, vol = 0.5, shape = 'sine', attack = 0.005 }) {
  let phase = 0
  const n = Math.floor(dur * RATE)
  const offset = Math.floor(start * RATE)
  for (let i = 0; i < n && offset + i < out.length; i++) {
    const t = i / n
    const f = freq + (freqEnd - freq) * t
    phase += (2 * Math.PI * f) / RATE
    const raw =
      shape === 'square' ? Math.sign(Math.sin(phase)) * 0.6
      : shape === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(phase))
      : Math.sin(phase)
    const env = Math.min(1, i / (attack * RATE)) * (1 - t) ** 1.5
    out[offset + i] += raw * env * vol
  }
}

const buffer = (secs) => new Float32Array(Math.floor(secs * RATE))

// Spin: quick rising reel ticks.
const spin = buffer(0.4)
for (let i = 0; i < 8; i++) tone(spin, { start: i * 0.045, dur: 0.03, freq: 700 + i * 90, vol: 0.35, shape: 'square' })

// Win: bright major arpeggio with a sparkle on top.
const win = buffer(0.75)
;[523, 659, 784].forEach((f, i) => tone(win, { start: i * 0.08, dur: 0.14, freq: f, vol: 0.45, shape: 'triangle' }))
tone(win, { start: 0.24, dur: 0.5, freq: 1047, vol: 0.5, shape: 'triangle' })
tone(win, { start: 0.24, dur: 0.4, freq: 2093, vol: 0.12 })

// Lose: two falling "wah" tones.
const lose = buffer(0.6)
tone(lose, { start: 0, dur: 0.22, freq: 330, freqEnd: 290, vol: 0.4, shape: 'square', attack: 0.02 })
tone(lose, { start: 0.22, dur: 0.38, freq: 262, freqEnd: 180, vol: 0.4, shape: 'square', attack: 0.02 })

mkdirSync('public/sounds', { recursive: true })
for (const [name, samples] of Object.entries({ spin, win, lose })) {
  writeFileSync(`public/sounds/${name}.wav`, wav(samples))
}
console.log('Wrote public/sounds/{spin,win,lose}.wav')
