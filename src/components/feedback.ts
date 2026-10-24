import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SoundName = 'spin' | 'win' | 'lose'

const FILES: Record<SoundName, string> = {
  spin: '/sounds/spin.wav',
  win: '/sounds/win.wav',
  lose: '/sounds/lose.wav',
}
const VOLUME = 0.6

interface SoundState {
  muted: boolean
  toggleMuted: () => void
}

/** Sound on/off. Muted by default; the choice is remembered. */
export const useSound = create<SoundState>()(
  persist(
    (set, get) => ({
      muted: true,
      toggleMuted: () => {
        const muted = !get().muted
        set({ muted })
        // Unmuting is a tap, which is when browsers allow audio to start.
        if (!muted) void unlockAudio()
      },
    }),
    { name: 'scroll-casino-sound' },
  ),
)

let ctx: AudioContext | null = null
const buffers = new Map<SoundName, AudioBuffer>()

/** Creates/resumes the AudioContext and loads the sounds. Must first run inside a user gesture. */
export async function unlockAudio() {
  if (!ctx) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    ctx = new Ctx()
    const audio = ctx
    await Promise.all(
      (Object.keys(FILES) as SoundName[]).map(async (name) => {
        try {
          const res = await fetch(FILES[name])
          buffers.set(name, await audio.decodeAudioData(await res.arrayBuffer()))
        } catch {
          // A missing sound just stays silent.
        }
      }),
    )
  }
  if (ctx.state === 'suspended') await ctx.resume()
}

export function playSound(name: SoundName) {
  if (useSound.getState().muted || !ctx) return
  const buffer = buffers.get(name)
  if (!buffer) return
  const source = ctx.createBufferSource()
  const gain = ctx.createGain()
  gain.gain.value = VOLUME
  source.buffer = buffer
  source.connect(gain).connect(ctx.destination)
  source.start()
}

/** navigator.vibrate where supported (Android Chrome); silently does nothing elsewhere (e.g. iOS). */
export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern)
  }
}

export const HAPTICS = {
  bet: 12,
  win: [30, 40, 60],
  bigWin: [60, 50, 60, 50, 250],
  lose: [140],
}
