import { useState } from 'react'
import { Keyboard, Mousewheel } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import { games } from '../games/registry'
import GameCard from './GameCard'

/** TikTok-style vertical feed: one full-screen card per registered game, looping. */
export default function Feed() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [hasSwiped, setHasSwiped] = useState(false)

  if (games.length === 0) {
    return (
      <div className="flex h-dvh items-center justify-center text-white/50">No games registered yet.</div>
    )
  }

  return (
    <Swiper
      className="h-dvh w-full"
      direction="vertical"
      slidesPerView={1}
      loop={games.length > 1}
      speed={280}
      threshold={6}
      resistanceRatio={0}
      longSwipesRatio={0.2}
      modules={[Mousewheel, Keyboard]}
      mousewheel={{ forceToAxis: true, thresholdDelta: 30 }}
      keyboard
      onSlideChange={(swiper) => {
        setActiveIndex(swiper.realIndex)
        setHasSwiped(true)
      }}
    >
      {games.map((game, i) => (
        <SwiperSlide key={game.id} className="h-dvh">
          <GameCard game={game} isActive={i === activeIndex} showHint={!hasSwiped} />
        </SwiperSlide>
      ))}
    </Swiper>
  )
}
