# WebTermX — Browser SSH Client

A MobaXterm-style browser SSH client: tabbed terminals, server inventory, SFTP browser, and themes. Connect to any SSH server from your browser via a WebSocket SSH gateway.

**Live demo → [Win1817.github.io/go-remote-dash](https://win1817.github.io/go-remote-dash/)**

![WebTermX screenshot](https://via.placeholder.com/900x500/11151c/60a5fa?text=WebTermX+Browser+SSH+Client)

## Features

- **Tabbed terminals** — open multiple SSH sessions side by side
- **Server inventory** — store server profiles with color labels, tags, and last-connected timestamps
- **Demo mode** — full in-browser fake shell (no gateway needed): `ls`, `cat`, `ps`, `df`, `free`, `top`, `grep`, `find`, history navigation (↑↓), tab completion, and 20+ commands
- **SFTP browser** — navigate the remote filesystem, context menus, list/icon views, breadcrumb navigation
- **Terminal search** — `Ctrl+F` in-terminal search powered by xterm.js SearchAddon
- **Themes** — Default, Dracula, Solarized, Monokai
- **Server filtering** — search by name/host/user, filter by tags
- **Reconnect** — one-click reconnect on closed/error sessions
- **Connection uptime** — live timer displayed in the status bar

## Quick start (local dev)

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Connecting to a real SSH server

WebTermX is a **frontend only** — it needs a companion SSH-over-WebSocket gateway:

```
Browser (WebTermX) ←——WSS——→ Gateway server ←——SSH——→ Your server
```

### Gateway wire protocol

```json
// Client → server
{ "type": "connect", "host": "...", "port": 22, "username": "...",
  "authType": "password", "password": "..." }
{ "type": "data",   "data": "<keystrokes>" }
{ "type": "resize", "cols": 120, "rows": 30 }
{ "type": "close" }

// Server → client
{ "type": "data",   "data": "<terminal output>" }
{ "type": "status", "status": "connected" | "closed" | "error", "message"?: "..." }
```

See [`src/lib/webtermx/transport.ts`](src/lib/webtermx/transport.ts) for the full spec.

### Gateway options

- **[wetty](https://github.com/butlerx/wetty)** — Node.js, drop-in WebSocket SSH proxy
- **[webssh](https://github.com/huashengdun/webssh)** — Python, similar protocol
- **Custom Go gateway** — implement the JSON wire protocol above over `gorilla/websocket` + `golang.org/x/crypto/ssh`

## Deploy to GitHub Pages

Push to `main` — the [GitHub Actions workflow](.github/workflows/deploy.yml) builds and deploys automatically.

Enable Pages in your repo settings: **Settings → Pages → Source: GitHub Actions**.

## Tech stack

- **React 19** + **TanStack Router** + **TanStack Start**
- **@xterm/xterm** v6 (FitAddon, SearchAddon, WebLinksAddon)
- **Tailwind CSS v4** + **Radix UI** + **shadcn/ui**
- **Bun** for package management and builds

## Project structure

```
src/
├── components/webtermx/
│   ├── Sidebar.tsx          # Server list, search, tags filter
│   ├── WorkspacePanel.tsx   # Tab bar, status bar, uptime counter
│   ├── TerminalPane.tsx     # xterm.js mount, search bar, reconnect overlay
│   ├── SftpPanel.tsx        # SFTP file browser (mock data, ready to wire)
│   ├── ServerDialog.tsx     # Add/edit server (color picker, tags, validation)
│   └── SettingsDialog.tsx   # Gateway URL, theme, font, scrollback, bell
├── lib/webtermx/
│   ├── store.tsx            # React Context state (servers, sessions, settings)
│   ├── transport.ts         # WebSocketTransport + DemoTransport
│   ├── storage.ts           # localStorage helpers
│   ├── themes.ts            # xterm.js color themes
│   └── types.ts             # ServerProfile, TerminalSession, AppSettings
└── routes/
    ├── __root.tsx           # HTML shell, meta tags
    └── index.tsx            # Main app route
```
