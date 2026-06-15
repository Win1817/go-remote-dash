import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { storage, uid } from "./storage";
import type { AppSettings, ServerProfile, TerminalSession } from "./types";

interface WebTermXState {
  servers: ServerProfile[];
  sessions: TerminalSession[];
  activeSessionId: string | null;
  settings: AppSettings;

  addServer: (s: Omit<ServerProfile, "id" | "createdAt">) => ServerProfile;
  updateServer: (id: string, patch: Partial<ServerProfile>) => void;
  deleteServer: (id: string) => void;

  openSession: (serverId: string) => void;
  closeSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string) => void;
  updateSessionStatus: (sessionId: string, status: TerminalSession["status"]) => void;
  reconnectSession: (sessionId: string) => void;

  updateSettings: (patch: Partial<AppSettings>) => void;
}

const Ctx = createContext<WebTermXState | null>(null);

export function WebTermXProvider({ children }: { children: ReactNode }) {
  const [servers, setServers] = useState<ServerProfile[]>(() => storage.getServers());
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => storage.getSettings());

  useEffect(() => storage.setServers(servers), [servers]);
  useEffect(() => storage.setSettings(settings), [settings]);

  // Seed a demo server on first load so the app isn't empty.
  useEffect(() => {
    if (servers.length === 0) {
      const demo: ServerProfile = {
        id: uid(),
        name: "demo-server",
        hostname: "demo.webtermx.local",
        port: 22,
        username: "ubuntu",
        authType: "password",
        password: "",
        color: "#3ddc97",
        tags: ["demo"],
        createdAt: Date.now(),
      };
      setServers([demo]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addServer = useCallback((s: Omit<ServerProfile, "id" | "createdAt">) => {
    const next: ServerProfile = { ...s, id: uid(), createdAt: Date.now() };
    setServers((prev) => [...prev, next]);
    return next;
  }, []);

  const updateServer = useCallback((id: string, patch: Partial<ServerProfile>) => {
    setServers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const deleteServer = useCallback((id: string) => {
    setServers((prev) => prev.filter((s) => s.id !== id));
    setSessions((prev) => prev.filter((t) => t.serverId !== id));
  }, []);

  const openSession = useCallback(
    (serverId: string) => {
      const server = servers.find((s) => s.id === serverId);
      if (!server) return;
      const sess: TerminalSession = {
        id: uid(),
        serverId,
        title: server.name,
        status: "connecting",
        createdAt: Date.now(),
      };
      setSessions((prev) => [...prev, sess]);
      setActiveSessionId(sess.id);
      // Track last connected time on the server profile
      setServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, lastConnectedAt: Date.now() } : s)),
      );
    },
    [servers],
  );

  const closeSession = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      setActiveSessionId((curr) => {
        if (curr !== sessionId) return curr;
        return next.length ? next[next.length - 1].id : null;
      });
      return next;
    });
  }, []);

  const reconnectSession = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;
      // Close the old session and open a fresh one for the same server
      closeSession(sessionId);
      setTimeout(() => openSession(session.serverId), 50);
    },
    [sessions, closeSession, openSession],
  );

  const updateSessionStatus = useCallback(
    (sessionId: string, status: TerminalSession["status"]) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, status, connectedAt: status === "connected" ? Date.now() : s.connectedAt }
            : s,
        ),
      );
    },
    [],
  );

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo<WebTermXState>(
    () => ({
      servers,
      sessions,
      activeSessionId,
      settings,
      addServer,
      updateServer,
      deleteServer,
      openSession,
      closeSession,
      reconnectSession,
      setActiveSession: setActiveSessionId,
      updateSessionStatus,
      updateSettings,
    }),
    [
      servers,
      sessions,
      activeSessionId,
      settings,
      addServer,
      updateServer,
      deleteServer,
      openSession,
      closeSession,
      reconnectSession,
      updateSessionStatus,
      updateSettings,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWebTermX() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWebTermX must be used within WebTermXProvider");
  return ctx;
}
