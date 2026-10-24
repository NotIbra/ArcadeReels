import type { GameEntry } from '../games/registry'

interface Props {
  game: GameEntry
  isActive: boolean
  showHint: boolean
}

// Top offset (as a % of the card) and start delay for each bat, so they never fly together.
const BATS = [
  { top: '17%', delay: '0s', size: 'text-lg' },
  { top: '29%', delay: '-6s', size: 'text-sm' },
  { top: '11%', delay: '-11.5s', size: 'text-base' },
]

/** Full-screen card shell: renders the game plus a name label, a swipe hint and the spooky atmosphere. */
export default function GameCard({ game, isActive, showHint }: Props) {
  const Game = game.component

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-casino-bg">
      <Game isActive={isActive} />

      <Atmosphere active={isActive} />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-[calc(max(0.75rem,env(safe-area-inset-top))+3.75rem)]">
        <span className="rounded-full bg-black/60 px-4 py-0.5 font-display text-xl tracking-wider text-coin drop-shadow-[0_0_8px_rgba(255,117,24,0.6)]">
          {game.name}
        </span>
      </div>

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center pb-[max(1rem,env(safe-area-inset-bottom))] text-white/75 transition-opacity duration-500 ${
          showHint ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span aria-hidden className="animate-bounce text-xl">⌃</span>
        <span className="text-xs font-semibold">swipe up for next game</span>
      </div>
    </div>
  )
}

/**
 * Drifting fog + a few bats. Only transform/opacity animate (GPU-composited, no repaints), nothing
 * takes taps, and every animation is paused while the card is off screen.
 */
function Atmosphere({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${active ? '' : '[&_*]:[animation-play-state:paused]'}`}
    >
      <div className="absolute inset-x-0 bottom-0 h-3/5 [mask-image:linear-gradient(to_top,black_30%,transparent)]">
        <div
          className="motion-safe-only absolute inset-y-0 left-0 w-[200%] animate-fog opacity-25 will-change-transform"
          style={{
            // Two identical tiles side by side, so sliding by -50% loops without a seam.
            backgroundImage:
              'radial-gradient(ellipse 30% 40% at 20% 70%, rgba(220,200,255,0.55), transparent 70%),' +
              'radial-gradient(ellipse 35% 30% at 65% 85%, rgba(200,190,240,0.45), transparent 70%),' +
              'radial-gradient(ellipse 25% 35% at 90% 60%, rgba(230,220,255,0.4), transparent 70%)',
            backgroundSize: '50% 100%',
            backgroundRepeat: 'repeat-x',
          }}
        />
      </div>

      {BATS.map((bat, i) => (
        <span
          key={i}
          className="motion-safe-only absolute left-0 animate-bat will-change-transform"
          style={{ top: bat.top, animationDelay: bat.delay }}
        >
          <span className={`motion-safe-only inline-block animate-flap opacity-70 ${bat.size}`}>🦇</span>
        </span>
      ))}
    </div>
  )
}
