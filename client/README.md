# Kadi Teri, client

The React progressive web app. The full guide, including how to run, test and deploy the whole game, is in the [README at the repo root](../README.md).

## Quick start

The client needs the game server running on port 3001, so start that first.

```bash
cd ../server && npm install && npm run dev
```

Then here:

```bash
npm install
npm run dev        # http://localhost:5173
```

Vite proxies `/socket.io` to the server and listens on your local network as well, so a phone on the same Wi-Fi can open the Network URL it prints.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then build into `dist/` |
| `npm run preview` | Serve the built output |
| `npm run lint` | Oxlint |

In production the server serves `dist/` itself, so there is no separate client deploy.

## Layout

```
src/
  screens/     one file per screen: Home, CreateRoom, JoinRoom, Lobby, Game, Score, Settings, Rules
  components/  shared pieces; components/game holds the table, hand and phase panels
  ui/          the touch-first primitive kit: Screen, Button, Chip, Sheet, Avatar, Switch
  lib/         socket client, identity, card helpers, audio, haptics, invites
  store/       Zustand stores for game state and settings
  hooks/       useGame, the derived view of the game for the local player
```

## Two things that will bite you

**The cascade.** `src/index.css` keeps its element rules inside `@layer base`. Unlayered CSS beats every layered rule regardless of specificity, so a bare `* { padding: 0 }` at the top level silently cancels every Tailwind padding utility in the app.

**The Tailwind plugin.** Tailwind v4 runs through `@tailwindcss/vite` in `vite.config.ts`. Remove it and no utility classes are generated at all, which looks like a broken stylesheet rather than a missing plugin.

## Environment

`VITE_SERVER_URL` overrides where the socket connects. Leave it unset: development falls back to `http://localhost:3001` and production uses the page's own origin.
