import type { ServerProfile } from "./types";

export type TransportEvent =
  | { type: "data"; data: string }
  | { type: "status"; status: "connecting" | "connected" | "closed" | "error"; message?: string };

export interface Transport {
  send(data: string): void;
  resize(cols: number, rows: number): void;
  close(): void;
  onEvent(cb: (e: TransportEvent) => void): () => void;
}

/* ---------- Real WebSocket transport ---------- */
/*
  Wire protocol (client <-> your SSH gateway):

  Client -> server:
    { "type": "connect", "host": "...", "port": 22, "username": "...",
      "authType": "password"|"key",
      "password"?: "...", "privateKey"?: "...", "passphrase"?: "..." }
    { "type": "data",   "data": "<keystrokes>" }
    { "type": "resize", "cols": 120, "rows": 30 }
    { "type": "close" }

  Server -> client (any of):
    Plain string frame      -> written directly to the terminal
    { "type": "data",   "data": "..." }
    { "type": "status", "status": "connected"|"closed"|"error", "message"?: "..." }
*/
export function createWebSocketTransport(opts: {
  url: string;
  profile: ServerProfile;
}): Transport {
  const listeners = new Set<(e: TransportEvent) => void>();
  const emit = (e: TransportEvent) => listeners.forEach((l) => l(e));

  emit({ type: "status", status: "connecting" });

  let ws: WebSocket;
  try {
    ws = new WebSocket(opts.url);
  } catch (err) {
    emit({
      type: "status",
      status: "error",
      message: err instanceof Error ? err.message : "Failed to open WebSocket",
    });
    return {
      send() {},
      resize() {},
      close() {},
      onEvent(cb) {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
    };
  }

  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        type: "connect",
        host: opts.profile.hostname,
        port: opts.profile.port,
        username: opts.profile.username,
        authType: opts.profile.authType,
        password: opts.profile.password,
        privateKey: opts.profile.privateKey,
        passphrase: opts.profile.passphrase,
      }),
    );
  };

  ws.onmessage = (ev) => {
    let payload: string;
    if (ev.data instanceof ArrayBuffer) {
      payload = new TextDecoder().decode(ev.data);
    } else {
      payload = String(ev.data);
    }
    if (payload.length && payload[0] === "{") {
      try {
        const msg = JSON.parse(payload);
        if (msg && typeof msg === "object" && "type" in msg) {
          if (msg.type === "data" && typeof msg.data === "string") {
            emit({ type: "data", data: msg.data });
            return;
          }
          if (msg.type === "status") {
            emit({ type: "status", status: msg.status, message: msg.message });
            return;
          }
        }
      } catch {
        /* fall through: treat as raw text */
      }
    }
    emit({ type: "data", data: payload });
  };

  ws.onerror = () => emit({ type: "status", status: "error", message: "WebSocket error" });
  ws.onclose = () => emit({ type: "status", status: "closed" });

  return {
    send(data: string) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "data", data }));
      }
    },
    resize(cols, rows) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    },
    close() {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "close" }));
        ws.close();
      } catch {
        /* ignore */
      }
    },
    onEvent(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

/* ---------- Demo transport (in-browser fake shell) ---------- */
export function createDemoTransport(profile: ServerProfile): Transport {
  const listeners = new Set<(e: TransportEvent) => void>();
  const emit = (e: TransportEvent) => listeners.forEach((l) => l(e));

  const prompt = `\x1b[1;32m${profile.username}@${profile.name}\x1b[0m:\x1b[1;34m~\x1b[0m$ `;
  let buffer = "";
  let closed = false;

  setTimeout(() => {
    emit({ type: "status", status: "connecting" });
  }, 0);
  setTimeout(() => {
    if (closed) return;
    emit({ type: "status", status: "connected" });
    emit({
      type: "data",
      data:
        "\x1b[1;36mWebTermX demo shell\x1b[0m — no real SSH connection.\r\n" +
        `Connected to \x1b[1m${profile.hostname}:${profile.port}\x1b[0m as \x1b[1m${profile.username}\x1b[0m\r\n` +
        `Type \x1b[1mhelp\x1b[0m for available commands.\r\n\r\n` +
        prompt,
    });
  }, 350);

  function run(cmdLine: string) {
    const [cmd, ...args] = cmdLine.trim().split(/\s+/);
    if (!cmd) return "";
    switch (cmd) {
      case "help":
        return "Available: help, whoami, pwd, ls, echo, date, uname, clear, exit\r\n";
      case "whoami":
        return `${profile.username}\r\n`;
      case "pwd":
        return `/home/${profile.username}\r\n`;
      case "ls":
        return "\x1b[1;34mDocuments\x1b[0m  \x1b[1;34mlogs\x1b[0m  app.jar  notes.txt  README.md\r\n";
      case "echo":
        return args.join(" ") + "\r\n";
      case "date":
        return new Date().toString() + "\r\n";
      case "uname":
        return "Linux webtermx-demo 6.1.0 x86_64\r\n";
      case "clear":
        return "\x1b[2J\x1b[H";
      case "exit":
        setTimeout(() => emit({ type: "status", status: "closed" }), 50);
        return "logout\r\n";
      default:
        return `\x1b[31m${cmd}: command not found\x1b[0m\r\n`;
    }
  }

  return {
    send(data: string) {
      if (closed) return;
      for (const ch of data) {
        if (ch === "\r") {
          const out = run(buffer);
          buffer = "";
          emit({ type: "data", data: "\r\n" + out + prompt });
        } else if (ch === "\u007f") {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            emit({ type: "data", data: "\b \b" });
          }
        } else if (ch === "\u0003") {
          buffer = "";
          emit({ type: "data", data: "^C\r\n" + prompt });
        } else if (ch >= " ") {
          buffer += ch;
          emit({ type: "data", data: ch });
        }
      }
    },
    resize() {},
    close() {
      closed = true;
      emit({ type: "status", status: "closed" });
    },
    onEvent(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
