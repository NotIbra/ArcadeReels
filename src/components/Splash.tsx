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
      aria-label="Scroll Casino: Haunted Edition"
      onPointerDown={(e) => (startY.current = e.clientY)}
      onPointerUp={(e) => {
        const dy = startY.current === null ? 0 : e.clientY - startY.current
        startY.current = null
        // Any tap or upward swipe starts the app; a downward drag is ignored.
        if (dy < 20) finish()
      }}
      className={`fixed inset-0 z-[80] flex touch-none flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_38%,#3a1450_0%,#0d0614_70%)] px-6 text-center transition-all ease-in ${
        leaving ? '-translate-y-full opacity-0' : ''
      }`}
      style={{ transitionDuration: `${EXIT_MS}ms` }}
    >
      {/* Moon behind the pumpkin. */}
      <div className="absolute left-1/2 top-[18%] h-44 w-44 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_42%_40%,#fff7e0_0%,#f3d9a4_45%,rgba(201,168,107,0.4)_68%,transparent_72%)] opacity-40 blur-[2px]" />
      <span aria-hidden className="relative animate-pop text-[7rem] leading-none drop-shadow-[0_0_40px_rgba(255,117,24,0.7)]">
        🎃
      </span>
      <h1 className="relative mt-4 font-display leading-[0.95] text-coin">
        <span className="motion-safe-only block animate-title-flicker text-6xl">Scroll Casino:</span>
        <span className="mt-1 block text-4xl text-white">Haunted Edition</span>
      </h1>
      <p className="relative mt-4 text-lg font-semibold text-white/85">Swipe if you dare — fake coins only</p>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-[max(2rem,env(safe-area-inset-bottom))] text-coin">
        <span aria-hidden className="animate-bounce text-3xl">⌃</span>
        <span className="text-sm font-bold uppercase tracking-[0.3em]">Swipe up</span>
        <span className="mt-4 text-xs text-white/60">No real money. Coins have no value.</span>
      </div>
    </div>
  )
}
