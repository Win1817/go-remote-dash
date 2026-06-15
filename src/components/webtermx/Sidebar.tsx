import { useState } from "react";
import { Plus, Server, Trash2, Pencil, Play, Settings as SettingsIcon, Terminal as TerminalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWebTermX } from "@/lib/webtermx/store";
import { ServerDialog } from "./ServerDialog";
import { SettingsDialog } from "./SettingsDialog";
import type { ServerProfile } from "@/lib/webtermx/types";

export function Sidebar() {
  const { servers, deleteServer, openSession, settings } = useWebTermX();
  const [serverDialog, setServerDialog] = useState<{ open: boolean; editing?: ServerProfile }>({ open: false });
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-3">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-primary">
          <TerminalIcon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold tracking-tight">WebTermX</div>
          <div className="text-[11px] text-muted-foreground">
            {settings.demoMode ? "Demo mode" : "Gateway connected"}
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={() => setSettingsOpen(true)} aria-label="Settings">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between px-3 pt-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Servers
        </div>
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => setServerDialog({ open: true })}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2 py-2">
        {servers.length === 0 && (
          <div className="px-3 py-6 text-xs text-muted-foreground">
            No servers yet. Click <span className="text-foreground">Add</span> to create one.
          </div>
        )}
        <ul className="space-y-1">
          {servers.map((s) => (
            <li
              key={s.id}
              className="group rounded-md border border-transparent px-2 py-2 transition-colors hover:border-sidebar-border hover:bg-sidebar-accent"
            >
              <div className="flex items-start gap-2">
                <Server className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {s.username}@{s.hostname}:{s.port}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="sm" variant="secondary" className="h-7 gap-1 px-2 text-xs" onClick={() => openSession(s.id)}>
                  <Play className="h-3 w-3" /> Connect
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit" onClick={() => setServerDialog({ open: true, editing: s })}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" aria-label="Delete" onClick={() => deleteServer(s.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </ScrollArea>

      <div className="border-t border-sidebar-border px-3 py-2 text-[11px] text-muted-foreground">
        Frontend only · sends I/O over WSS to your gateway
      </div>

      <ServerDialog
        open={serverDialog.open}
        editing={serverDialog.editing}
        onOpenChange={(o) => setServerDialog({ open: o, editing: o ? serverDialog.editing : undefined })}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </aside>
  );
}
