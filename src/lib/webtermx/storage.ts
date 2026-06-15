import { type ServerProfile, type AppSettings, DEFAULT_SETTINGS } from "./types";

const SERVERS_KEY = "webtermx.servers.v1";
const SETTINGS_KEY = "webtermx.settings.v1";
const HISTORY_KEY = "webtermx.history.v1";

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

export const storage = {
  getServers(): ServerProfile[] {
    return safeRead<ServerProfile[]>(SERVERS_KEY, []);
  },
  setServers(servers: ServerProfile[]) {
    safeWrite(SERVERS_KEY, servers);
  },
  getSettings(): AppSettings {
    return { ...DEFAULT_SETTINGS, ...safeRead<Partial<AppSettings>>(SETTINGS_KEY, {}) };
  },
  setSettings(s: AppSettings) {
    safeWrite(SETTINGS_KEY, s);
  },
  getHistory(serverId: string): string[] {
    const all = safeRead<Record<string, string[]>>(HISTORY_KEY, {});
    return all[serverId] ?? [];
  },
  pushHistory(serverId: string, command: string) {
    const all = safeRead<Record<string, string[]>>(HISTORY_KEY, {});
    const list = all[serverId] ?? [];
    list.push(command);
    all[serverId] = list.slice(-500);
    safeWrite(HISTORY_KEY, all);
  },
};

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
