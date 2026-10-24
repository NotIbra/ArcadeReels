import { useRef, useState } from 'react'
import { unlockAudio, useSound } from './feedback'

const EXIT_MS = 450

/** Opening screen. Swipe up or tap to start; that first tap also unlocks audio if sound is on. */
export default function Splash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const startY = useRef<number | null>(null)

  const finish = () => {
    if (leaving) return
    if (!useSound.getState().muted) void unlockAudio()
    setLeaving(true)
    setTimeout(onDone, EXIT_MS)
  }

  return (
    <div
      role="dialog"
      aria-label="Scroll Casino"
      onPointerDown={(e) => (startY.current = e.clientY)}
      onPointerUp={(e) => {
        const dy = startY.current === null ? 0 : e.clientY - startY.current
        startY.current = null
        // Any tap or upward swipe starts the app; a downward drag is ignored.
        if (dy < 20) finish()
      }}
      className={`fixed inset-0 z-[80] flex touch-none flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#2e0b3a_0%,#07060b_70%)] px-6 text-center transition-all ease-in ${
        leaving ? '-translate-y-full opacity-0' : ''
      }`}
      style={{ transitionDuration: `${EXIT_MS}ms` }}
    >
      <img
        src="/logo.svg"
        alt=""
        className="h-36 w-36 animate-pop drop-shadow-[0_0_40px_rgba(232,121,249,0.55)]"
      />
      <h1 className="mt-6 animate-pop text-5xl font-black tracking-tight text-coin drop-shadow-[0_0_18px_rgba(250,204,21,0.6)]">
        Scroll Casino
      </h1>
      <p className="mt-3 text-lg font-semibold text-white/80">Swipe to play — fake coins only</p>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-[max(2rem,env(safe-area-inset-bottom))] text-neon">
        <span aria-hidden className="animate-bounce text-3xl">⌃</span>
        <span className="text-sm font-bold uppercase tracking-[0.3em]">Swipe up</span>
        <span className="mt-4 text-xs text-white/40">No real money. Coins have no value.</span>
      </div>
    </div>
  )
}
