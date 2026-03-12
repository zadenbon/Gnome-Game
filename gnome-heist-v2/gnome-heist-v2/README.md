# 🩲 Gnome Underpants Heist v2

Multiplayer online 2D gnome platformer. Protect your pants. Steal everyone else's.

## How to play with friends

1. One person opens the game and clicks **Create Room** → gets a 4-letter code like `GZRP`
2. Share that code with friends
3. Friends open the game, enter the code, click **Join Room**
4. Once everyone is in the lobby, the **host** clicks **Start Heist!**
5. Steal pants, protect your own, most pants wins after 90 seconds

## Controls
| Action | Keys |
|--------|------|
| Move | A/D or ←/→ |
| Jump | W, Space, or ↑ |
| Dash | Shift |
| Steal 🩲 | E or F |
| Mobile | On-screen buttons |

## Lobby features
- 4-letter room codes (e.g. `GZRP`)
- Up to 8 gnomes per room
- Host controls when the round starts
- If the host leaves, host transfers automatically
- After each round, everyone returns to the lobby

---

## Run locally

```bash
npm install
npm start
# Open http://localhost:3000
# Open a second tab and join with the room code to test!
```

---

## Deploy free on Railway (recommended, easiest)

1. Create a GitHub repo and push this folder to it
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Select your repo — Railway detects Node.js automatically
4. It gives you a public URL like `https://gnome-game.up.railway.app`
5. Share that URL with friends — they visit it, enter your code, done!

## Deploy free on Render

1. Push to GitHub
2. [render.com](https://render.com) → New Web Service → connect repo
3. Build command: `npm install` | Start command: `npm start`
4. Deploy and share the URL

## Deploy on Fly.io

```bash
npm install -g flyctl
fly auth login
fly launch
fly deploy
```

---

## Project structure

```
gnome-underpants-heist/
├── server.js          # Game server: rooms, physics loop, Socket.io
├── public/
│   └── index.html     # Full client: lobby UI + canvas game renderer
├── package.json
└── README.md
```
