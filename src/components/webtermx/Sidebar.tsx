import { useState, useMemo } from "react";
import {
  Plus, Server, Trash2, Pencil, Play, Settings as SettingsIcon,
  Terminal as TerminalIcon, Clock, Tag, ChevronDown, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useWebTermX } from "@/lib/webtermx/store";
import { ServerDialog } from "./ServerDialog";
import { SettingsDialog } from "./SettingsDialog";
import type { ServerProfile } from "@/lib/webtermx/types";

function timeAgo(ts?: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ServerItem({
  server,
  onConnect,
  onEdit,
  onDelete,
}: {
  server: ServerProfile;
  onConnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { sessions } = useWebTermX();
  const activeSessions = sessions.filter((s) => s.serverId === server.id);
  const hasActive = activeSessions.some((s) => s.status === "connected");

  return (
    <li className="group rounded-md border border-transparent px-2 py-2 transition-colors hover:border-sidebar-border hover:bg-sidebar-accent">
      <div className="flex items-start gap-2">
        {/* Color indicator */}
        <div className="mt-1 flex flex-col items-center gap-1">
          <div
            className="h-3 w-3 rounded-full border border-black/10"
            style={{ backgroundColor: server.color ?? "#888" }}
          />
          {hasActive && (
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" title="Active session" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{server.name}</span>
            {activeSessions.length > 0 && (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {activeSessions.length}
              </span>
            )}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {server.username}@{server.hostname}:{server.port}
          </div>
          {server.lastConnectedAt && (
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(server.lastConnectedAt)}
            </div>
          )}
          {server.tags && server.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {server.tags.map((t) => (
                <span
                  key={t}
                  className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          size="sm"
          variant="secondary"
          className="h-7 gap-1 px-2 text-xs"
          onClick={onConnect}
        >
          <Play className="h-3 w-3" /> Connect
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label="Edit"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          aria-label="Delete"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}

export function Sidebar() {
  const { servers, deleteServer, openSession, settings, sessions } = useWebTermX();
  const [serverDialog, setServerDialog] = useState<{ open: boolean; editing?: ServerProfile }>({
    open: false,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tagsExpanded, setTagsExpanded] = useState(true);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    servers.forEach((s) => s.tags?.forEach((t) => tagSet.add(t)));
    return [...tagSet].sort();
  }, [servers]);

  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return servers.filter((s) => {
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.hostname.toLowerCase().includes(search.toLowerCase()) ||
        s.username.toLowerCase().includes(search.toLowerCase());
      const matchesTag = !activeTag || s.tags?.includes(activeTag);
      return matchesSearch && matchesTag;
    });
  }, [servers, search, activeTag]);

  const totalActive = sessions.filter((s) => s.status === "connected").length;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-3">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-primary">
          <TerminalIcon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">WebTermX</span>
            {totalActive > 0 && (
              <span className="rounded-full bg-success/20 px-1.5 py-0.5 text-[10px] font-medium text-success">
                {totalActive} live
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {settings.demoMode ? "Demo mode" : "Gateway connected"}
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter servers…"
          className="h-7 text-xs"
        />
      </div>

      {/* Tags filter */}
      {allTags.length > 0 && (
        <div className="px-3 pt-2">
          <button
            className="flex w-full items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
            onClick={() => setTagsExpanded((v) => !v)}
          >
            <Tag className="h-3 w-3" />
            Tags
            {tagsExpanded ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
          </button>
          {tagsExpanded && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <button
                className={[
                  "rounded px-2 py-0.5 text-[10px] transition-colors",
                  activeTag === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                ].join(" ")}
                onClick={() => setActiveTag(null)}
              >
                all
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  className={[
                    "rounded px-2 py-0.5 text-[10px] transition-colors",
                    activeTag === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                  onClick={() => setActiveTag(activeTag === t ? null : t)}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Servers list header */}
      <div className="flex items-center justify-between px-3 pt-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Servers{filtered.length !== servers.length ? ` (${filtered.length}/${servers.length})` : ` (${servers.length})`}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => setServerDialog({ open: true })}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2 py-2">
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-xs text-muted-foreground">
            {search || activeTag
              ? "No servers match the filter."
              : <>No servers yet. Click <span className="text-foreground">Add</span> to create one.</>}
          </div>
        )}
        <ul className="space-y-1">
          {filtered.map((s) => (
            <ServerItem
              key={s.id}
              server={s}
              onConnect={() => openSession(s.id)}
              onEdit={() => setServerDialog({ open: true, editing: s })}
              onDelete={() => deleteServer(s.id)}
            />
          ))}
        </ul>
      </ScrollArea>

      {/* Keyboard shortcuts hint */}
      <div className="border-t border-sidebar-border px-3 py-2">
        <div className="text-[10px] text-muted-foreground/70">
          <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">Ctrl+F</kbd> search ·{" "}
          <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">Ctrl+Shift+C</kbd> copy
        </div>
      </div>

      <ServerDialog
        open={serverDialog.open}
        editing={serverDialog.editing}
        onOpenChange={(o) =>
          setServerDialog({ open: o, editing: o ? serverDialog.editing : undefined })
        }
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </aside>
  );
}
