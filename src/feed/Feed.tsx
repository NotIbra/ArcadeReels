import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Keyboard, Mousewheel } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import { games } from '../games/registry'
import GameCard from './GameCard'

// A game can't come back within this many cards of its last appearance.
const NO_REPEAT_WITHIN = 3
// Keep at least this many cards queued ahead of the current one.
const QUEUE_AHEAD = 4

/** A random next game that isn't one of the last NO_REPEAT_WITHIN cards. */
function nextGameId(order: string[]) {
  const recent = order.slice(-NO_REPEAT_WITHIN)
  let pool = games.filter((g) => !recent.includes(g.id))
  // Only reachable with very few registered games: then just avoid an immediate repeat.
  if (pool.length === 0) pool = games.filter((g) => g.id !== order[order.length - 1])
  if (pool.length === 0) pool = games
  return pool[Math.floor(Math.random() * pool.length)].id
}

function extend(order: string[], length: number) {
  const out = [...order]
  while (out.length < length) out.push(nextGameId(out))
  return out
}

/**
 * TikTok-style endless feed of randomly ordered games.
 *
 * The feed is a growing list of card slots. Each game is mounted exactly ONCE (rendered through a
 * portal into its own persistent <div>), and that div is moved into whichever slot is showing the
 * game. So a game keeps its state (a frozen Crash round, a half-scratched card) when it leaves and
 * later comes back in a different slot. Only the current card and its two neighbours hold a game;
 * NO_REPEAT_WITHIN ≥ 2 guarantees those three are always different games. The other games wait in
 * a hidden full-size "parking" div so they can still measure themselves.
 */
export default function Feed({ paused = false, initialGameId }: { paused?: boolean; initialGameId?: string | null }) {
  const [order, setOrder] = useState(() => {
    const first = games.some((g) => g.id === initialGameId) ? [initialGameId!] : []
    return extend(first, QUEUE_AHEAD + 1)
  })
  const [activeIndex, setActiveIndex] = useState(0)
  const [hasSwiped, setHasSwiped] = useState(false)

  const [hosts] = useState(() => new Map(games.map((g) => [g.id, Object.assign(document.createElement('div'), { className: 'h-full w-full' })])))
  const slideEls = useRef<(HTMLDivElement | null)[]>([])
  const parkingRef = useRef<HTMLDivElement>(null)

  // Runs before the games' own effects, so a game is already in place (and measurable) by the time
  // it sees isActive change.
  useLayoutEffect(() => {
    const placement = new Map<string, HTMLElement>()
    for (const offset of [0, -1, 1]) {
      const i = activeIndex + offset
      const slide = slideEls.current[i]
      if (slide && order[i] && !placement.has(order[i])) placement.set(order[i], slide)
    }
    for (const [id, host] of hosts) {
      const target = placement.get(id) ?? parkingRef.current
      if (target && host.parentElement !== target) target.appendChild(host)
    }
  }, [activeIndex, order, hosts])

  if (games.length === 0) {
    return (
      <div className="flex h-dvh items-center justify-center text-white/50">No games registered yet.</div>
    )
  }

  const activeId = order[activeIndex]

  return (
    <>
      <Swiper
        className="h-dvh w-full"
        direction="vertical"
        slidesPerView={1}
        speed={280}
        threshold={6}
        resistanceRatio={0}
        longSwipesRatio={0.2}
        modules={[Mousewheel, Keyboard]}
        mousewheel={{ forceToAxis: true, thresholdDelta: 30 }}
        keyboard
        onSlideChange={(swiper) => {
          const i = swiper.activeIndex
          setActiveIndex(i)
          setHasSwiped(true)
          setOrder((o) => (i + QUEUE_AHEAD >= o.length ? extend(o, i + QUEUE_AHEAD + 1) : o))
        }}
      >
        {order.map((id, i) => (
          <SwiperSlide key={i} className="h-dvh">
            <div
              ref={(el) => void (slideEls.current[i] = el)}
              data-game={id}
              className="h-full w-full bg-casino-bg"
            />
          </SwiperSlide>
        ))}
      </Swiper>

      <div
        ref={parkingRef}
        aria-hidden
        className="pointer-events-none invisible fixed left-0 top-0 h-dvh w-full -translate-x-[200%]"
      />

      {games.map((game) =>
        createPortal(
          <GameCard game={game} isActive={game.id === activeId && !paused} showHint={!hasSwiped} />,
          hosts.get(game.id)!,
          game.id,
        ),
      )}
    </>
  )
}
