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
    { "type": "ping" }

  Server -> client (any of):
    Plain string frame      -> written directly to the terminal
    { "type": "data",   "data": "..." }
    { "type": "status", "status": "connected"|"closed"|"error", "message"?: "..." }
    { "type": "pong",   "latency": 42 }
*/
export function createWebSocketTransport(opts: {
  url: string;
  profile: ServerProfile;
}): Transport {
  const listeners = new Set<(e: TransportEvent) => void>();
  const emit = (e: TransportEvent) => listeners.forEach((l) => l(e));

  // Guard: if no URL was provided, show a helpful message instead of crashing
  if (!opts.url || !opts.url.startsWith("ws")) {
    setTimeout(() => {
      emit({
        type: "data",
        data:
          "\x1b[1;31m╔══════════════════════════════════════════════╗\x1b[0m\r\n" +
          "\x1b[1;31m║         No SSH Gateway Configured            ║\x1b[0m\r\n" +
          "\x1b[1;31m╚══════════════════════════════════════════════╝\x1b[0m\r\n\r\n" +
          "\x1b[33mThis is a frontend-only SPA — real SSH connections\x1b[0m\r\n" +
          "\x1b[33mrequire a WebSocket SSH gateway server.\x1b[0m\r\n\r\n" +
          "\x1b[1mTo connect to real servers:\x1b[0m\r\n" +
          "  1. Deploy a WebSocket SSH proxy:\r\n" +
          "     \x1b[36mhttps://github.com/butlerx/wetty\x1b[0m\r\n" +
          "     \x1b[36mhttps://github.com/huashengdun/webssh\x1b[0m\r\n" +
          "  2. Open \x1b[1mSettings\x1b[0m (gear icon in sidebar)\r\n" +
          "  3. Paste your gateway WSS URL\r\n\r\n" +
          "\x1b[90mOr enable Demo Mode in Settings to explore with a\x1b[0m\r\n" +
          "\x1b[90msimulated shell — no backend needed.\x1b[0m\r\n",
      });
      emit({ type: "status", status: "error", message: "No gateway URL configured" });
    }, 200);
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
          if (msg.type === "pong") {
            // latency info – no-op for now, could expose via event
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

const DEMO_FS: Record<string, string[]> = {
  "~": ["Documents", "logs", "app.jar", "notes.txt", "README.md", ".bashrc", ".ssh"],
  "~/Documents": ["report.pdf", "spec.md", "budget.xlsx"],
  "~/logs": ["app.log", "error.log", "access.log"],
  "~/.ssh": ["authorized_keys", "known_hosts", "id_rsa.pub"],
};

export function createDemoTransport(profile: ServerProfile): Transport {
  const listeners = new Set<(e: TransportEvent) => void>();
  const emit = (e: TransportEvent) => listeners.forEach((l) => l(e));

  let cwd = "~";
  let buffer = "";
  let historyList: string[] = [];
  let historyIdx = -1;
  let closed = false;
  let envVars: Record<string, string> = {
    HOME: `/home/${profile.username}`,
    USER: profile.username,
    SHELL: "/bin/bash",
    TERM: "xterm-256color",
    PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  };

  const prompt = () =>
    `\x1b[1;32m${profile.username}@${profile.name}\x1b[0m:\x1b[1;34m${cwd}\x1b[0m$ `;

  setTimeout(() => emit({ type: "status", status: "connecting" }), 0);
  setTimeout(() => {
    if (closed) return;
    emit({ type: "status", status: "connected" });
    emit({
      type: "data",
      data:
        "\x1b[1;36m╔══════════════════════════════════════╗\x1b[0m\r\n" +
        "\x1b[1;36m║       WebTermX Demo Shell            ║\x1b[0m\r\n" +
        "\x1b[1;36m╚══════════════════════════════════════╝\x1b[0m\r\n" +
        `Connected to \x1b[1m${profile.hostname}:${profile.port}\x1b[0m as \x1b[1m${profile.username}\x1b[0m\r\n` +
        `Type \x1b[1mhelp\x1b[0m for available commands.\r\n\r\n` +
        prompt(),
    });
  }, 350);

  function resolvePath(p: string): string {
    if (p.startsWith("~")) return p;
    if (p.startsWith("/")) return p;
    if (p === "..") {
      const parts = cwd.split("/");
      return parts.length > 1 ? parts.slice(0, -1).join("/") || "~" : "~";
    }
    return cwd === "~" ? `~/${p}` : `${cwd}/${p}`;
  }

  function run(cmdLine: string): string {
    const trimmed = cmdLine.trim();
    if (!trimmed) return "";

    // Handle env var assignment (VAR=value)
    if (/^[A-Z_]+=/.test(trimmed) && !trimmed.includes(" ")) {
      const [k, ...rest] = trimmed.split("=");
      envVars[k] = rest.join("=");
      return "";
    }

    // Handle variable expansion
    const expanded = trimmed.replace(/\$(\w+)/g, (_, k) => envVars[k] ?? "");
    const parts = expanded.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
    const [cmd, ...args] = parts.map((p) => p.replace(/^["']|["']$/g, ""));

    switch (cmd) {
      case "help":
        return (
          "\x1b[1mAvailable commands:\x1b[0m\r\n" +
          "  \x1b[1;32mNavigation:\x1b[0m  cd, pwd, ls, ll, tree\r\n" +
          "  \x1b[1;32mInfo:\x1b[0m        whoami, id, hostname, uname, uptime, env, echo, date, cal\r\n" +
          "  \x1b[1;32mFiles:\x1b[0m       cat, head, tail, wc, grep, find, touch, mkdir\r\n" +
          "  \x1b[1;32mSystem:\x1b[0m      ps, top, df, free, history, clear, exit\r\n" +
          "  \x1b[1;32mNetwork:\x1b[0m     curl, ping, netstat, ss\r\n"
        );

      case "whoami":
        return `${profile.username}\r\n`;

      case "id":
        return `uid=1000(${profile.username}) gid=1000(${profile.username}) groups=1000(${profile.username}),4(adm),24(cdrom),27(sudo),46(plugdev)\r\n`;

      case "hostname":
        return `${profile.name}\r\n`;

      case "pwd":
        return `${cwd.replace("~", envVars.HOME)}\r\n`;

      case "cd": {
        const target = args[0] ?? "~";
        const next = resolvePath(target);
        if (DEMO_FS[next] !== undefined || next === "~") {
          cwd = next;
          return "";
        }
        return `\x1b[31mbash: cd: ${args[0]}: No such file or directory\x1b[0m\r\n`;
      }

      case "ls":
      case "ll": {
        const dir = args.find((a) => !a.startsWith("-")) ?? cwd;
        const resolved = resolvePath(dir);
        const entries = DEMO_FS[resolved] ?? DEMO_FS[cwd] ?? [];
        const showAll = args.includes("-a") || args.includes("-la") || args.includes("-al");
        const longFormat = cmd === "ll" || args.includes("-l") || args.includes("-la") || args.includes("-al");
        const all = showAll ? [".", ".."] : [];
        const items = [...all, ...entries];
        if (longFormat) {
          const now = new Date();
          const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
          return (
            `total ${items.length * 4}\r\n` +
            items
              .map((e) => {
                const isDir = e === "." || e === ".." || DEMO_FS[`${resolved}/${e}`] || DEMO_FS[`~/${e}`];
                const color = isDir ? "\x1b[1;34m" : e.startsWith(".") ? "\x1b[0;33m" : "\x1b[0m";
                const perm = isDir ? "drwxr-xr-x" : "-rw-r--r--";
                const size = isDir ? "4096" : String(Math.floor(Math.random() * 50000 + 1000));
                return `${perm}  1 ${profile.username} ${profile.username} ${size.padStart(8)} ${dateStr} ${color}${e}\x1b[0m`;
              })
              .join("\r\n") +
            "\r\n"
          );
        }
        return (
          items
            .map((e) => {
              const isDir = e === "." || e === ".." || DEMO_FS[`${resolved}/${e}`] || DEMO_FS[`~/${e}`];
              return isDir ? `\x1b[1;34m${e}\x1b[0m` : e.startsWith(".") ? `\x1b[0;33m${e}\x1b[0m` : e;
            })
            .join("  ") + "\r\n"
        );
      }

      case "tree": {
        const lines = [`\x1b[1;34m${cwd}\x1b[0m`];
        const entries = DEMO_FS[cwd] ?? [];
        entries.forEach((e, i) => {
          const isLast = i === entries.length - 1;
          const prefix = isLast ? "└── " : "├── ";
          const isDir = DEMO_FS[`${cwd}/${e}`];
          lines.push(prefix + (isDir ? `\x1b[1;34m${e}\x1b[0m` : e));
          if (isDir) {
            DEMO_FS[`${cwd}/${e}`]?.forEach((sub, si, arr) => {
              const sublast = si === arr.length - 1;
              lines.push((isLast ? "    " : "│   ") + (sublast ? "└── " : "├── ") + sub);
            });
          }
        });
        lines.push(`\r\n${entries.length} items`);
        return lines.join("\r\n") + "\r\n";
      }

      case "cat": {
        if (!args[0]) return "\x1b[31mcat: missing operand\x1b[0m\r\n";
        const file = args[0];
        if (file === ".bashrc")
          return "# ~/.bashrc\nexport PS1='\\u@\\h:\\w\\$ '\nalias ll='ls -la'\nalias la='ls -A'\n".replace(/\n/g, "\r\n");
        if (file === "notes.txt")
          return "TODO:\r\n- Update server configs\r\n- Review access logs\r\n- Check disk usage\r\n";
        if (file === "README.md")
          return `# ${profile.name}\r\n\r\nDemo server managed by WebTermX.\r\n\r\n## Quick start\r\n\r\n\`\`\`bash\r\nuname -a\r\ndf -h\r\nfree -m\r\n\`\`\`\r\n`;
        if (file.endsWith(".log"))
          return `[2024-01-15 10:23:11] INFO  Server started\r\n[2024-01-15 10:23:12] INFO  Listening on :8080\r\n[2024-01-15 10:24:03] WARN  High memory usage detected\r\n[2024-01-15 10:25:00] INFO  Healthcheck OK\r\n`;
        return `\x1b[31mcat: ${file}: No such file or directory\x1b[0m\r\n`;
      }

      case "head":
      case "tail": {
        if (!args[0]) return `\x1b[31m${cmd}: missing file operand\x1b[0m\r\n`;
        const content = `[2024-01-15 10:23:11] INFO  Server started\r\n[2024-01-15 10:23:12] INFO  Listening on :8080\r\n[2024-01-15 10:24:03] WARN  High memory usage\r\n[2024-01-15 10:25:00] INFO  Healthcheck OK\r\n[2024-01-15 10:26:00] INFO  Request processed\r\n`;
        return content;
      }

      case "echo":
        return args.join(" ") + "\r\n";

      case "env":
        return (
          Object.entries(envVars)
            .map(([k, v]) => `${k}=${v}`)
            .join("\r\n") + "\r\n"
        );

      case "export":
        if (args[0]?.includes("=")) {
          const [k, ...rest] = args[0].split("=");
          envVars[k] = rest.join("=");
          return "";
        }
        return Object.entries(envVars)
          .map(([k, v]) => `declare -x ${k}="${v}"`)
          .join("\r\n") + "\r\n";

      case "date":
        return new Date().toString() + "\r\n";

      case "cal": {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const first = new Date(y, m, 1).getDay();
        const days = new Date(y, m + 1, 0).getDate();
        let out = `   ${months[m]} ${y}\r\nSu Mo Tu We Th Fr Sa\r\n`;
        let row = "   ".repeat(first);
        for (let d = 1; d <= days; d++) {
          const isToday = d === now.getDate();
          row += (isToday ? `\x1b[7m${String(d).padStart(2)}\x1b[0m` : String(d).padStart(2)) + " ";
          if ((d + first) % 7 === 0) { out += row.trimEnd() + "\r\n"; row = ""; }
        }
        if (row) out += row.trimEnd() + "\r\n";
        return out;
      }

      case "uname": {
        const flag = args[0] ?? "";
        if (flag === "-a" || flag === "--all")
          return `Linux ${profile.name} 6.1.0-21-amd64 #1 SMP Debian 6.1.90-1 x86_64 GNU/Linux\r\n`;
        if (flag === "-r") return "6.1.0-21-amd64\r\n";
        if (flag === "-m") return "x86_64\r\n";
        return `Linux\r\n`;
      }

      case "uptime":
        return ` ${new Date().toTimeString().slice(0, 5)}  up 14 days,  3:22,  1 user,  load average: 0.08, 0.12, 0.10\r\n`;

      case "ps": {
        const all = args.includes("aux") || args.includes("-aux") || args.includes("a");
        if (all) {
          return (
            "USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\r\n" +
            `${profile.username.padEnd(12)} 1234  0.0  0.1  12345  2048 pts/0    Ss   10:00   0:00 -bash\r\n` +
            `${profile.username.padEnd(12)} 5678  0.5  2.3 234567 47892 ?        Sl   10:01   1:23 node /app/server.js\r\n` +
            `${profile.username.padEnd(12)} 9012  0.0  0.0   8192  1024 pts/0    R+   10:25   0:00 ps aux\r\n`
          );
        }
        return (
          "  PID TTY          TIME CMD\r\n" +
          " 1234 pts/0    00:00:00 bash\r\n" +
          " 9012 pts/0    00:00:00 ps\r\n"
        );
      }

      case "top":
        return (
          `top - ${new Date().toTimeString().slice(0,8)} up 14 days, 3:22, 1 user, load avg: 0.08, 0.12, 0.10\r\n` +
          "Tasks: 142 total,   1 running, 141 sleeping,   0 stopped,   0 zombie\r\n" +
          "%Cpu(s):  2.3 us,  0.8 sy,  0.0 ni, 96.5 id,  0.3 wa,  0.0 hi,  0.1 si\r\n" +
          "MiB Mem :   3934.8 total,    421.2 free,   1823.4 used,   1690.2 buff/cache\r\n" +
          "MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   1934.3 avail Mem\r\n\r\n" +
          "  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND\r\n" +
          ` 5678 ${profile.username.padEnd(9)}  20   0  234m   47m   12m S   0.5   2.3   1:23.45 node\r\n` +
          ` 1234 ${profile.username.padEnd(9)}  20   0   12m    2m    1m S   0.0   0.1   0:00.12 bash\r\n`
        );

      case "df": {
        const h = args.includes("-h");
        return (
          "Filesystem      Size  Used Avail Use% Mounted on\r\n" +
          `/dev/sda1       ${h ? "50G" : "52428800"}   ${h ? "14G" : "14680064"}   ${h ? "34G" : "35651584"}  29% /\r\n` +
          `tmpfs           ${h ? "2.0G" : "2097152"}     ${h ? "0" : "0"}   ${h ? "2.0G" : "2097152"}   0% /dev/shm\r\n`
        );
      }

      case "free": {
        const h = args.includes("-h") || args.includes("-m");
        return (
          "               total        used        free      shared  buff/cache   available\r\n" +
          `Mem:        ${h ? "  3934M" : "4028416"}    ${h ? "1823M" : "1867164"}    ${h ? " 421M" : "431172"}    ${h ? "  12M" : "12288"}    ${h ? "1690M" : "1730080"}    ${h ? "1934M" : "1980852"}\r\n` +
          `Swap:       ${h ? "  2048M" : "2097152"}       ${h ? "   0M" : "0"}    ${h ? "2048M" : "2097148"}\r\n`
        );
      }

      case "grep": {
        if (args.length < 2) return `\x1b[31mgrep: missing argument\x1b[0m\r\n`;
        const pattern = args[0];
        return `\x1b[35m${args[1]}\x1b[0m:\x1b[32m42\x1b[0m: ${pattern} found here\r\n`;
      }

      case "find": {
        const dir = args[0] ?? ".";
        const nameFlag = args.indexOf("-name");
        const name = nameFlag >= 0 ? args[nameFlag + 1] : "*";
        return `${dir}/${name?.replace("*.", "sample.")}\r\n${dir}/subdir/${name?.replace("*.", "another.")}\r\n`;
      }

      case "touch":
        if (!args[0]) return "\x1b[31mtouch: missing operand\x1b[0m\r\n";
        return "";

      case "mkdir":
        if (!args[0]) return "\x1b[31mmkdir: missing operand\x1b[0m\r\n";
        return "";

      case "wc": {
        const file = args.find((a) => !a.startsWith("-"));
        return `  42  156  823 ${file ?? ""}\r\n`;
      }

      case "curl":
      case "wget": {
        if (!args[0]) return `\x1b[31m${cmd}: no URL provided\x1b[0m\r\n`;
        return `\x1b[33m[demo] ${cmd}: network access not available in demo mode\x1b[0m\r\n`;
      }

      case "ping": {
        if (!args[0]) return "\x1b[31mping: missing host\x1b[0m\r\n";
        return (
          `PING ${args[0]} (93.184.216.34): 56 data bytes\r\n` +
          `64 bytes from 93.184.216.34: icmp_seq=0 ttl=52 time=11.${Math.floor(Math.random()*900+100)} ms\r\n` +
          `\x1b[33m[demo] ping stopped\x1b[0m\r\n`
        );
      }

      case "netstat":
      case "ss":
        return (
          "Netid  State   Recv-Q  Send-Q  Local Address:Port    Peer Address:Port\r\n" +
          "tcp    LISTEN  0       128     0.0.0.0:22           0.0.0.0:*\r\n" +
          "tcp    LISTEN  0       511     0.0.0.0:80           0.0.0.0:*\r\n" +
          "tcp    ESTAB   0       0       10.0.0.1:22          10.0.0.2:54321\r\n"
        );

      case "history":
        return historyList
          .slice(-20)
          .map((h, i) => `  ${String(i + 1).padStart(3)}  ${h}`)
          .join("\r\n") + "\r\n";

      case "clear":
        return "\x1b[2J\x1b[H";

      case "exit":
      case "logout":
        setTimeout(() => emit({ type: "status", status: "closed" }), 50);
        return "logout\r\n";

      default:
        return `\x1b[31mbash: ${cmd}: command not found\x1b[0m\r\n`;
    }
  }

  return {
    send(data: string) {
      if (closed) return;
      for (const ch of data) {
        if (ch === "\r") {
          const out = run(buffer);
          if (buffer.trim()) {
            historyList.push(buffer);
            historyIdx = -1;
          }
          buffer = "";
          emit({ type: "data", data: "\r\n" + out + prompt() });
        } else if (ch === "\u007f") {
          // Backspace
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            emit({ type: "data", data: "\b \b" });
          }
        } else if (ch === "\u0003") {
          // Ctrl+C
          buffer = "";
          historyIdx = -1;
          emit({ type: "data", data: "^C\r\n" + prompt() });
        } else if (ch === "\u0004") {
          // Ctrl+D
          if (buffer.length === 0) {
            buffer = "exit";
            emit({ type: "data", data: "exit" });
            setTimeout(() => {
              const out = run("exit");
              emit({ type: "data", data: "\r\n" + out });
            }, 10);
          }
        } else if (ch === "\u001b[A") {
          // Arrow up — history
          if (historyList.length > 0) {
            historyIdx = historyIdx === -1 ? historyList.length - 1 : Math.max(0, historyIdx - 1);
            const entry = historyList[historyIdx] ?? "";
            emit({ type: "data", data: "\r\x1b[K" + prompt() + entry });
            buffer = entry;
          }
        } else if (ch === "\u001b[B") {
          // Arrow down — history
          if (historyIdx >= 0) {
            historyIdx = historyIdx < historyList.length - 1 ? historyIdx + 1 : -1;
            const entry = historyIdx === -1 ? "" : (historyList[historyIdx] ?? "");
            emit({ type: "data", data: "\r\x1b[K" + prompt() + entry });
            buffer = entry;
          }
        } else if (ch === "\u0009") {
          // Tab completion (basic)
          const entries = DEMO_FS[cwd] ?? [];
          const matches = entries.filter((e) => e.startsWith(buffer.split(" ").pop() ?? ""));
          if (matches.length === 1) {
            const word = buffer.split(" ").pop() ?? "";
            const completion = matches[0].slice(word.length);
            buffer += completion;
            emit({ type: "data", data: completion });
          } else if (matches.length > 1) {
            emit({ type: "data", data: "\r\n" + matches.join("  ") + "\r\n" + prompt() + buffer });
          }
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
