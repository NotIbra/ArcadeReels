import { useSound } from './feedback'

export default function MuteButton() {
  const muted = useSound((s) => s.muted)
  const toggleMuted = useSound((s) => s.toggleMuted)

  return (
    <button
      type="button"
      onClick={toggleMuted}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      aria-pressed={!muted}
      className={`pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border bg-black/70 backdrop-blur active:scale-95 ${
        muted ? 'border-white/15 text-white/50' : 'border-neon/60 text-neon shadow-[0_0_14px_rgba(178,107,255,0.45)]'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" fillOpacity="0.25" />
        {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
      </svg>
    </button>
  )
}
