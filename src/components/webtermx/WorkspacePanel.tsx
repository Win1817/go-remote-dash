import { X, Plus, Folder, TerminalSquare, Copy, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWebTermX } from "@/lib/webtermx/store";
import { TerminalPane } from "./TerminalPane";
import { SftpPanel } from "./SftpPanel";
import type { ConnectionStatus } from "@/lib/webtermx/types";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  idle: "Idle",
  connecting: "Connecting…",
  connected: "Connected",
  closed: "Closed",
  error: "Error",
};

const STATUS_COLOR: Record<ConnectionStatus, string> = {
  idle: "text-muted-foreground",
  connecting: "text-amber-400",
  connected: "text-emerald-400",
  closed: "text-muted-foreground",
  error: "text-red-400",
};

function UptimeDisplay({ connectedAt }: { connectedAt?: number }) {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceRender((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!connectedAt) return null;
  const secs = Math.floor((Date.now() - connectedAt) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const str = h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
  return <span className="tabular-nums">{str}</span>;
}

export function WorkspacePanel() {
  const { sessions, activeSessionId, setActiveSession, closeSession, reconnectSession, servers, openSession } = useWebTermX();
  const [showSftp, setShowSftp] = useState(false);

  const active = sessions.find((s) => s.id === activeSessionId) ?? null;
  const activeServer = active ? servers.find((s) => s.id === active.serverId) : null;

  const copyConnectionInfo = () => {
    if (!activeServer) return;
    const info = `${activeServer.username}@${activeServer.hostname}:${activeServer.port}`;
    navigator.clipboard.writeText(info).catch(() => {});
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border bg-card/40 px-2 py-1.5">
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {sessions.length === 0 && (
            <div className="px-3 py-1 text-xs text-muted-foreground">
              No active terminals — connect a server from the sidebar.
            </div>
          )}
          {sessions.map((s) => {
            const srv = servers.find((srv) => srv.id === s.serverId);
            const isActive = s.id === activeSessionId;
            return (
              <div
                key={s.id}
                className={[
                  "group flex items-center gap-2 rounded-t-md border border-b-0 px-3 py-1.5 text-xs transition-colors",
                  isActive
                    ? "border-border bg-background text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {/* Server color pip */}
                {srv?.color && (
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: srv.color }}
                  />
                )}
                <button onClick={() => setActiveSession(s.id)} className="flex items-center gap-1.5">
                  <span className="status-dot" data-status={s.status} />
                  <span className="max-w-[120px] truncate font-mono">{s.title}</span>
                </button>
                {/* Reconnect on closed/error */}
                {(s.status === "closed" || s.status === "error") && (
                  <button
                    onClick={() => reconnectSession(s.id)}
                    className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent/20 hover:text-amber-400 group-hover:opacity-100"
                    aria-label="Reconnect"
                    title="Reconnect"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={() => closeSession(s.id)}
                  className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent/20 hover:text-foreground group-hover:opacity-100"
                  aria-label="Close tab"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="New tab">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {servers.length === 0 ? (
              <DropdownMenuItem disabled>No servers configured</DropdownMenuItem>
            ) : (
              servers.map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => openSession(s.id)}>
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-full border border-black/10"
                    style={{ backgroundColor: s.color ?? "#888" }}
                  />
                  <span className="truncate">{s.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {s.username}@{s.hostname}
                  </span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          variant={showSftp ? "secondary" : "ghost"}
          className="ml-1 h-7 gap-1 px-2 text-xs"
          onClick={() => setShowSftp((v) => !v)}
          title="Toggle SFTP panel"
        >
          <Folder className="h-3.5 w-3.5" /> SFTP
        </Button>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col bg-terminal">
          {sessions.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {/* Status bar */}
              <div className="flex items-center justify-between border-b border-border/60 bg-card/30 px-3 py-1 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2 font-mono">
                  {activeServer && (
                    <>
                      <button
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={copyConnectionInfo}
                        title="Copy connection string"
                      >
                        <span>{activeServer.username}@{activeServer.hostname}:{activeServer.port}</span>
                        <Copy className="h-2.5 w-2.5 opacity-50" />
                      </button>
                      <span className="text-border">·</span>
                    </>
                  )}
                  <span className={`flex items-center gap-1 ${STATUS_COLOR[active?.status ?? "idle"]}`}>
                    <span className="status-dot" data-status={active?.status ?? "idle"} />
                    {active ? STATUS_LABEL[active.status] : "—"}
                  </span>
                  {active?.status === "connected" && active.connectedAt && (
                    <>
                      <span className="text-border">·</span>
                      <UptimeDisplay connectedAt={active.connectedAt} />
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]">WebTermX</span>
                  <span className="text-border">·</span>
                  <span className="text-[10px]">{sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
                </div>
              </div>

              <div className="relative min-h-0 flex-1">
                {sessions.map((s) => (
                  <div key={s.id} className="absolute inset-0">
                    <TerminalPane session={s} active={s.id === activeSessionId} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {showSftp && (
          <div className="hidden w-96 shrink-0 border-l border-border md:block">
            <SftpPanel
              username={activeServer?.username ?? "ubuntu"}
              hostname={activeServer?.hostname}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  const { servers, openSession } = useWebTermX();
  const recentServer = [...servers].sort((a, b) => (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0))[0];

  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
          <TerminalSquare className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold">Welcome to WebTermX</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a server in the sidebar and click{" "}
          <span className="text-foreground">Connect</span> to open a terminal tab.
        </p>
        {recentServer && (
          <button
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/20"
            onClick={() => openSession(recentServer.id)}
          >
            <TerminalSquare className="h-3.5 w-3.5" />
            Reconnect to {recentServer.name}
          </button>
        )}
        <p className="mt-4 text-[11px] text-muted-foreground">
          Demo mode is on by default — switch it off in{" "}
          <span className="text-foreground">Settings</span> to use your real SSH gateway.
        </p>
        <div className="mt-4 flex justify-center gap-4 text-[10px] text-muted-foreground/70">
          <span><kbd className="rounded bg-muted px-1 font-mono">Ctrl+F</kbd> search</span>
          <span><kbd className="rounded bg-muted px-1 font-mono">Ctrl+Shift+C</kbd> copy</span>
          <span><kbd className="rounded bg-muted px-1 font-mono">↑↓</kbd> history</span>
        </div>
      </div>
    </div>
  );
}
