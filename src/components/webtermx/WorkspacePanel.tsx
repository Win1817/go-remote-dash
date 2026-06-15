import { X, Plus, Folder, TerminalSquare } from "lucide-react";
import { useState } from "react";
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

export function WorkspacePanel() {
  const { sessions, activeSessionId, setActiveSession, closeSession, servers, openSession } = useWebTermX();
  const [showSftp, setShowSftp] = useState(true);

  const active = sessions.find((s) => s.id === activeSessionId) ?? null;
  const activeServer = active ? servers.find((s) => s.id === active.serverId) : null;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border bg-card/40 px-2 py-1.5">
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {sessions.length === 0 && (
            <div className="px-3 py-1 text-xs text-muted-foreground">
              No active terminals. Connect to a server from the sidebar.
            </div>
          )}
          {sessions.map((s) => {
            const isActive = s.id === activeSessionId;
            return (
              <div
                key={s.id}
                className={[
                  "group flex items-center gap-2 rounded-t-md border border-b-0 px-3 py-1.5 text-xs",
                  isActive
                    ? "border-border bg-background text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <button onClick={() => setActiveSession(s.id)} className="flex items-center gap-2">
                  <span className="status-dot" data-status={s.status} />
                  <span className="font-mono">{s.title}</span>
                </button>
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
                  <TerminalSquare className="mr-2 h-4 w-4" />
                  <span className="truncate">{s.name}</span>
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
              <div className="flex items-center justify-between border-b border-border/60 bg-card/30 px-3 py-1 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2 font-mono">
                  {activeServer && (
                    <>
                      <span>{activeServer.username}@{activeServer.hostname}:{activeServer.port}</span>
                      <span className="text-border">·</span>
                    </>
                  )}
                  <span className="status-dot" data-status={active?.status ?? "idle"} />
                  <span>{active ? STATUS_LABEL[active.status] : "—"}</span>
                </div>
                <div>WebTermX terminal</div>
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
            <SftpPanel username={activeServer?.username ?? "ubuntu"} />
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
          <TerminalSquare className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold">Welcome to WebTermX</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a server in the sidebar and click <span className="text-foreground">Connect</span> to open a terminal tab.
        </p>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Demo mode is on by default — switch it off in Settings to use your real SSH gateway.
        </p>
      </div>
    </div>
  );
}
