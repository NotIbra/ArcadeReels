# Scroll Casino – project brief

A mobile-first web app: a TikTok-style vertical feed where each full-screen card is a mini casino game. All games share one FAKE coin wallet. No real money, no accounts, no backend.

## Stack
- React + Vite + TypeScript
- Tailwind CSS for styling
- Swiper.js for the vertical swipe feed
- Zustand for state, persisted to localStorage
- canvas-confetti for win effects; Matter.js only for Plinko
- Deploy target: Vercel (static site)

## Folder structure
- src/feed/ – the swipe feed and card shell
- src/wallet/ – wallet store and coin display
- src/games/ – ONE file per game, e.g. src/games/Slots.tsx
- src/games/registry.ts – the list of games the feed shows
- src/stats/ – stats screen
- src/components/ – shared UI (BetSelector, ResultBanner)

## The game contract (every game MUST follow this)
- A game is a React component with no props except `isActive: boolean` (true when its card is on screen).
- It reads and changes coins ONLY via the wallet store: placeBet(amount) returns false if not enough coins; payout(amount) adds winnings; recordRound({ game, bet, won, payout }).
- It uses the shared <BetSelector /> for choosing a bet (10 / 50 / 100 / All in).
- It fills the full card (100dvh), is playable with one thumb, and pauses animations when isActive is false.
- It is registered by adding one line to src/games/registry.ts.

## Design
- Dark theme, neon casino vibe: near-black background, gold for coins, green for wins, red for losses.
- Big tap targets (min 48px), large readable numbers, smooth 60fps animations.
- Test at 390x844 (iPhone size) first.

## Rules for the AI
- Never change the wallet store's API or another person's game file unless asked.
- Keep each game self-contained in its own file.
- After every change, make sure `npm run build` passes with no TypeScript errors.
- Fake money only. Never add payments, real-money features or links to gambling sites.
