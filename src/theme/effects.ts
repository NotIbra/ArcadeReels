import confetti from 'canvas-confetti'
import { halloween, SPOOKY_EMOJI } from './halloween'

const EMOJI_SCALE = 2.2
let shapes: confetti.Shape[] | null = null

// Built on first use (needs a canvas), then reused.
const emojiShapes = () =>
  (shapes ??= SPOOKY_EMOJI.map((text) => confetti.shapeFromText({ text, scalar: EMOJI_SCALE })))

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** Win effect: a burst of 🎃 👻 🦇 🍬. Replaces the old confetti. */
export function spookyBurst({
  particleCount = 40,
  origin = { x: 0.5, y: 0.5 },
  spread = 80,
}: { particleCount?: number; origin?: { x?: number; y?: number }; spread?: number } = {}) {
  confetti({
    particleCount,
    spread,
    origin,
    shapes: emojiShapes(),
    scalar: EMOJI_SCALE,
    flat: true,
    ticks: 160,
    gravity: 0.9,
    startVelocity: 38,
    disableForReducedMotion: true,
  })
}

/** Side cannons for the big-win screen; call once per frame while celebrating. */
export function spookyCannons() {
  for (const [x, angle] of [[0, 60], [1, 120]] as const) {
    confetti({
      particleCount: 2,
      angle,
      spread: 55,
      origin: { x, y: 0.75 },
      shapes: emojiShapes(),
      scalar: EMOJI_SCALE,
      flat: true,
      ticks: 180,
      disableForReducedMotion: true,
    })
  }
}

/** Loss effect: a quick screen flicker plus a blood-red vignette. Replaces the old shake. */
export function lossFlicker() {
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '65',
    pointerEvents: 'none',
    background: `radial-gradient(ellipse at center, transparent 40%, ${halloween.colors.blood} 100%)`,
    boxShadow: `inset 0 0 80px 20px ${halloween.colors.blood}`,
  })
  document.body.appendChild(el)
  // Reduced motion: a single soft fade instead of flicker.
  const frames = reducedMotion()
    ? [{ opacity: 0.8 }, { opacity: 0 }]
    : [
        { opacity: 0, backgroundColor: 'rgba(0,0,0,0)' },
        { opacity: 1, backgroundColor: 'rgba(0,0,0,0.55)', offset: 0.08 },
        { opacity: 0.4, backgroundColor: 'rgba(0,0,0,0)', offset: 0.16 },
        { opacity: 1, backgroundColor: 'rgba(0,0,0,0.4)', offset: 0.26 },
        { opacity: 0.85, backgroundColor: 'rgba(0,0,0,0)', offset: 0.4 },
        { opacity: 0 },
      ]
  el.animate(frames, { duration: 750, easing: 'ease-out' }).onfinish = () => el.remove()
}
