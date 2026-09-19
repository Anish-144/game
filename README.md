# Kadi Teri

A mobile-first card game of hidden partnerships, for four to ten players. Portrait phones are the target and the reference viewport is 390 x 844.

- `server/` — authoritative game engine, bots, and Socket.io room server (TypeScript, Express)
- `client/` — React 19 progressive web app (Vite, Tailwind v4, Zustand, framer-motion)

The server is the only place that knows the full state. Hands never leave it except to the one player holding them.

---

## Running it locally

Two terminals, one for each side.

```bash
cd server && npm install && npm run dev     # http://localhost:3001
cd client && npm install && npm run dev     # http://localhost:5173
```

Open http://localhost:5173. The Vite dev server proxies `/socket.io` to port 3001 and also listens on your local network, so a phone on the same Wi-Fi can open the Network URL that Vite prints.

To run it the way a server would, as one process on one port:

```bash
npm run build && npm start                  # http://localhost:3001
```

That builds the client, builds the server, and has Express serve the built client alongside the socket. This is the same path production takes.

---

## Testing

**On a desktop.** Open the app, press `F12`, then `Ctrl + Shift + M`, and choose iPhone 15 Pro. The three-dot menu in the device toolbar has "Show device frame".

**Fastest smoke test.** Home, then Play with Bots, then Bots only, then Create room, then Start game. Pass on your first bid and the bots play the round out in roughly two and a half minutes.

**Two players on one machine.** Use a second browser profile or an incognito window, not a second tab. Tabs in the same profile share one stored player id, so the second one is treated as the first player reconnecting.

**On a phone over local Wi-Fi.** Open the Network URL Vite prints. Two browser rules apply on a plain HTTP address: the QR scanner and the native share sheet only work on a secure origin, so over local HTTP the scanner reports no camera access and Share link falls back to copying. Join with the room code instead, or deploy and use the HTTPS URL.

**Worth trying to break.** Tap a card during the trick pause, which should queue rather than jump ahead. Refresh mid-round, which should return you to your seat with your hand. Add and remove bots in the lobby. Join a room that is already full.

**Developer preview.** Settings has a Developer preview toggle, visible only in a dev build, that overlays live phase, turn, trump and socket state on the table.

---

## Going live

The whole app deploys as a single web service. The client's socket connects to `window.location.origin` in production, so there is nothing to configure once both halves sit behind one URL.

The host must support long-lived WebSocket connections and must run **one instance**. Rooms are held in memory, so a second instance would hold its own separate rooms. That rules out serverless platforms such as Vercel and Netlify for the server.

### Render, recommended for a permanent URL

`render.yaml` in the repo root already describes the service.

1. Put the project in a Git repository and push it to GitHub.
   ```bash
   git init && git add -A && git commit -m "Kadi Teri" && git branch -M main
   git remote add origin <your repo url> && git push -u origin main
   ```
2. On render.com choose **New**, then **Blueprint**, and point it at the repository. Render reads `render.yaml`.
3. Wait for the first build, then open the `onrender.com` URL it gives you and share that with your friends.

Two things to know about the free plan. The service sleeps after about fifteen minutes with no traffic, so the first visit afterwards takes roughly a minute to wake. A sleep or a redeploy also ends any game in progress, because rooms are in memory. Moving to the paid starter plan removes the sleeping.

Without the blueprint, the settings are: build command `npm run build`, start command `npm start`, health check path `/health`, Node 20.

### Railway or Fly.io

Both work the same way: build with `npm run build`, start with `npm start`, expose the port from `PORT`, keep one instance. Railway does not sleep, which makes it the better choice if the waking delay bothers you.

### Playing tonight without deploying

Run the production build locally and open a tunnel, which gives you an HTTPS URL that works from anywhere, including the camera QR scanner.

```bash
npm run build && npm start
npx cloudflared tunnel --url http://localhost:3001
```

Your machine has to stay awake and online for as long as you are playing.

### Checking a deploy

`GET /health` returns `{"status":"ok","version":"3.0.0","servingClient":true}`. If `servingClient` is false the client build is missing, which means the build step did not run or `CLIENT_DIR` points somewhere wrong.

---

## The game

| Mode | Deck | Players | Bids | Partner cards |
|---|---|---|---|---|
| Classic | 52 cards | 4 to 6 | 125 to 250 | 1, or 2 at six players |
| Kadi Teri 500 | 104 cards | 4 to 10 | 125 to 500 | 1 to 4 by table size |

Point cards: the 3 of spades scores 30, every ace, king, queen, jack and ten scores 10, and every five scores 5. A single deck holds 250 points and a double deck 500.

The declarer's partner cards are announced to the table, so whoever holds one knows at once that they are on the declaring side. Who holds them stays hidden until the card is played.

Running points are public, but they are never summed across the declaring side until every partner has revealed. The declarer's seat counts against the contract, other seats count against the points the declaring side has not taken, and the moment the last partner reveals, the whole side switches to one shared team figure.

### Flow

```
Home -> Create room -> Lobby -> Game -> Score
             |            ^
          Join room ------+   (code, invite link, or QR scan)
```

The host is seated the moment a room is created, along with any bots they asked for. The host starts the game once every seat is filled.

---

## Bots

Three difficulties, all decided in `server/src/engine/botBrain.ts`. Those are pure functions that see only what a human in the same seat would see: their own hand plus public state.

| Difficulty | Behaviour |
|---|---|
| Easy | Any legal card, folds early in the auction |
| Medium | Protects point cards, bids close to its hand value, feeds points to a proven partner |
| Hard | Pulls trumps, counts what is left, and holds likely partner cards back early to stay hidden |

`server/src/engine/bot.ts` drives them: one loop per room, guarded so two callers cannot race, with a pause before each move.

Pacing lives in `server/src/engine/timing.ts`. A finished trick rests on the table for `TRICK_SETTLE_MS` before it is swept, and both bots and people are held behind that pause.

---

## Socket events

Client to server: `create-room`, `join-room`, `add-bot`, `remove-bot`, `start-game`, `share-invite`, `place-bid`, `pass`, `select-trump`, `select-partners`, `play-card`, `reconnect-player`, `leave-room`.

Server to client: `room-created`, `room-joined`, `lobby-update`, `invite`, `game-started`, `your-hand`, `declarer-hand`, `bidding-started`, `bid-placed`, `bid-passed`, `bidding-complete`, `trump-selected`, `partners-selected`, `card-played`, `partner-revealed`, `trick-won`, `round-finished`, `reconnected`, `player-left`, `player-disconnected`, `player-reconnected`, `error`.

---

## Notes for anyone touching the code

**Styles.** `client/src/index.css` keeps its element rules inside `@layer base`. Unlayered CSS beats every layered rule in the cascade, so a bare `* { padding: 0 }` silently cancels every Tailwind padding class.

**Tailwind.** It is wired through `@tailwindcss/vite` in `client/vite.config.ts`. Without that plugin no utility classes are generated at all.

**State.** Rooms and games live in a `Map` in `server/src/rooms/room.ts`. Nothing is persisted, so a restart ends every game in progress. Adding a database or Redis would be the first step toward more than one instance.
