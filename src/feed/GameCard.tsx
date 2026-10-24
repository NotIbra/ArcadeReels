import type { GameEntry } from '../games/registry'

interface Props {
  game: GameEntry
  isActive: boolean
  showHint: boolean
}

/** Full-screen card shell: renders the game plus a name label and a swipe hint on top. */
export default function GameCard({ game, isActive, showHint }: Props) {
  const Game = game.component

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-casino-bg">
      <Game isActive={isActive} />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-[calc(max(0.75rem,env(safe-area-inset-top))+3.75rem)]">
        <span className="rounded-full bg-black/50 px-3 py-1 text-sm font-bold uppercase tracking-widest text-white/80">
          {game.name}
        </span>
      </div>

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center pb-[max(1rem,env(safe-area-inset-bottom))] text-white/70 transition-opacity duration-500 ${
          showHint ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span aria-hidden className="animate-bounce text-xl">⌃</span>
        <span className="text-xs font-semibold">swipe up for next game</span>
      </div>
    </div>
  )
}
