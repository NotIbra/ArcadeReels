/**
 * Halloween design tokens. Tailwind gets the same values through the @theme block in index.css
 * (Tailwind 4 has no tailwind.config.js) — keep the two in sync. Canvas-drawn games (Plinko, Crash)
 * and effects read the colours from here.
 */
export const halloween = {
  colors: {
    bg: '#0d0614', // near-black purple
    card: '#1a0f26',
    pumpkin: '#ff7518', // main accent; also the coin colour
    pumpkinGlow: 'rgba(255,117,24,0.55)',
    toxic: '#39ff14', // wins
    toxicGlow: 'rgba(57,255,20,0.45)',
    blood: '#b3001b', // losses: fills, vignette
    // #b3001b is too dark to read as text on #0d0614 (≈2.8:1), so loss TEXT uses this lifted red (≈5.6:1).
    bloodText: '#ff3347',
    ghost: '#f3eefc', // ghostly white text
    spectral: '#b26bff', // secondary accent (was neon pink)
    spectralGlow: 'rgba(178,107,255,0.5)',
    moss: '#1c2a12',
    bone: '#efe8d8',
  },
  fonts: {
    display: '"Creepster", "Inter", system-ui, sans-serif',
    body: '"Inter", system-ui, sans-serif',
  },
} as const

export const SPOOKY_EMOJI = ['🎃', '👻', '🦇', '🍬'] as const
