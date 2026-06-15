import {
  Folder, File as FileIcon, ArrowUp, RefreshCw, Upload,
  Download, Home, ChevronRight, HardDrive, FolderPlus, Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface FileEntry {
  name: string;
  type: "dir" | "file";
  size?: number;
  modified?: string;
  permissions?: string;
}

// Demo file tree — replace with gateway SFTP API calls
const MOCK_TREE: Record<string, FileEntry[]> = {
  "/": [
    { name: "home", type: "dir" },
    { name: "etc", type: "dir" },
    { name: "var", type: "dir" },
    { name: "opt", type: "dir" },
  ],
  "/home": [
    { name: "ubuntu", type: "dir" },
    { name: "deploy", type: "dir" },
  ],
  "/home/ubuntu": [
    { name: "Documents", type: "dir", modified: "Jan 15" },
    { name: "logs", type: "dir", modified: "Jan 15" },
    { name: ".ssh", type: "dir", modified: "Jan 10" },
    { name: "app.jar", type: "file", size: 18_823_120, modified: "Jan 14", permissions: "-rwxr-xr-x" },
    { name: "notes.txt", type: "file", size: 1432, modified: "Jan 15", permissions: "-rw-r--r--" },
    { name: "README.md", type: "file", size: 2841, modified: "Jan 12", permissions: "-rw-r--r--" },
    { name: ".bashrc", type: "file", size: 3526, modified: "Jan 01", permissions: "-rw-r--r--" },
  ],
  "/home/ubuntu/Documents": [
    { name: "report.pdf", type: "file", size: 482_124, modified: "Jan 13", permissions: "-rw-r--r--" },
    { name: "spec.md", type: "file", size: 8231, modified: "Jan 11", permissions: "-rw-r--r--" },
    { name: "budget.xlsx", type: "file", size: 24_512, modified: "Jan 09", permissions: "-rw-r--r--" },
  ],
  "/home/ubuntu/logs": [
    { name: "app.log", type: "file", size: 2_104_993, modified: "Jan 15", permissions: "-rw-r--r--" },
    { name: "error.log", type: "file", size: 12_412, modified: "Jan 15", permissions: "-rw-r--r--" },
    { name: "access.log", type: "file", size: 845_203, modified: "Jan 15", permissions: "-rw-r--r--" },
  ],
  "/home/ubuntu/.ssh": [
    { name: "authorized_keys", type: "file", size: 742, modified: "Jan 10", permissions: "-rw-------" },
    { name: "known_hosts", type: "file", size: 2341, modified: "Jan 10", permissions: "-rw-r--r--" },
  ],
  "/home/deploy": [
    { name: "app", type: "dir" },
    { name: "releases", type: "dir" },
  ],
  "/etc": [
    { name: "nginx", type: "dir" },
    { name: "ssh", type: "dir" },
    { name: "hostname", type: "file", size: 12, modified: "Jan 01", permissions: "-rw-r--r--" },
    { name: "hosts", type: "file", size: 221, modified: "Jan 01", permissions: "-rw-r--r--" },
  ],
  "/var": [
    { name: "log", type: "dir" },
    { name: "www", type: "dir" },
  ],
};

function fmtSize(n?: number) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function getFileIcon(entry: FileEntry) {
  if (entry.type === "dir") return <Folder className="h-4 w-4 shrink-0 text-amber-400" />;
  const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
  const colors: Record<string, string> = {
    md: "text-blue-400", txt: "text-blue-300",
    log: "text-yellow-600", pdf: "text-red-400",
    xlsx: "text-green-400", jar: "text-purple-400",
    sh: "text-emerald-400", bashrc: "text-emerald-400",
  };
  return <FileIcon className={`h-4 w-4 shrink-0 ${colors[ext] ?? "text-muted-foreground"}`} />;
}

export function SftpPanel({ username, hostname }: { username: string; hostname?: string }) {
  const homeDir = `/home/${username || "ubuntu"}`;
  const [cwd, setCwd] = useState(homeDir);
  const [pathInput, setPathInput] = useState(homeDir);
  const [selected, setSelected] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "details">("details");

  const entries = useMemo<FileEntry[]>(() => {
    const result = MOCK_TREE[cwd] ?? [];
    // Sort: dirs first, then files, alphabetically
    return [...result].sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [cwd]);

  const navigate = (path: string) => {
    setCwd(path);
    setPathInput(path);
    setSelected(null);
  };

  const goUp = () => {
    if (cwd === "/") return;
    const next = cwd.replace(/\/[^/]+$/, "") || "/";
    navigate(next);
  };

  const breadcrumbs = useMemo(() => {
    const parts = cwd === "/" ? [""] : cwd.split("/");
    return parts.map((_, i, arr) => ({
      label: arr[i] || "/",
      path: arr.slice(0, i + 1).join("/") || "/",
    }));
  }, [cwd]);

  const totalSize = entries.reduce((sum, e) => sum + (e.size ?? 0), 0);

  return (
    <div className="flex h-full flex-col bg-card text-card-foreground text-sm">
      {/* Header */}
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={() => navigate(homeDir)}
          aria-label="Home"
          title="Home directory"
        >
          <Home className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={goUp}
          aria-label="Go up"
          disabled={cwd === "/"}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          aria-label="Refresh"
          title="Refresh (demo: no-op)"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Input
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate(pathInput);
            if (e.key === "Escape") setPathInput(cwd);
          }}
          className="h-7 flex-1 font-mono text-xs"
          aria-label="Current path"
        />
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border/50 px-2 py-1 text-[11px] text-muted-foreground">
        <HardDrive className="h-3 w-3 shrink-0 mr-0.5" />
        {hostname && <span className="shrink-0 mr-1 font-medium text-foreground/60">{hostname}</span>}
        {breadcrumbs.map((bc, i) => (
          <span key={bc.path} className="flex items-center gap-0.5 shrink-0">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
            <button
              onClick={() => navigate(bc.path)}
              className={[
                "px-0.5 hover:text-foreground transition-colors",
                i === breadcrumbs.length - 1 ? "text-foreground font-medium" : "",
              ].join(" ")}
            >
              {bc.label}
            </button>
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border/50 px-2 py-1">
        <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-xs" title="Upload file (demo: no-op)">
          <Upload className="h-3 w-3" /> Upload
        </Button>
        <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-xs" title="New folder (demo: no-op)">
          <FolderPlus className="h-3 w-3" /> Folder
        </Button>
        <div className="flex-1" />
        <button
          onClick={() => setViewMode(viewMode === "list" ? "details" : "list")}
          className="rounded p-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          title="Toggle view"
        >
          {viewMode === "list" ? "Details" : "List"}
        </button>
      </div>

      {/* File list */}
      <ScrollArea className="flex-1">
        {viewMode === "details" ? (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-card text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Name</th>
                <th className="px-2 py-1.5 text-right font-medium hidden sm:table-cell">Size</th>
                <th className="px-2 py-1.5 text-right font-medium hidden md:table-cell">Modified</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    Empty directory
                  </td>
                </tr>
              )}
              {entries.map((e) => (
                <ContextMenu key={e.name}>
                  <ContextMenuTrigger asChild>
                    <tr
                      className={[
                        "border-t border-border/40 cursor-pointer transition-colors",
                        selected === e.name ? "bg-accent/20" : "hover:bg-accent/10",
                      ].join(" ")}
                      onClick={() => setSelected(selected === e.name ? null : e.name)}
                      onDoubleClick={() => {
                        if (e.type === "dir") {
                          navigate(cwd === "/" ? `/${e.name}` : `${cwd}/${e.name}`);
                        }
                      }}
                    >
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          {getFileIcon(e)}
                          <span className={e.type === "dir" ? "font-medium" : ""}>{e.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground hidden sm:table-cell">
                        {e.type === "file" ? fmtSize(e.size) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground hidden md:table-cell">
                        {e.modified ?? "—"}
                      </td>
                      <td className="px-1.5 py-1.5 text-right">
                        {e.type === "file" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            aria-label="Download"
                            title="Download (demo: no-op)"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {e.type === "dir" ? (
                      <ContextMenuItem onClick={() => navigate(cwd === "/" ? `/${e.name}` : `${cwd}/${e.name}`)}>
                        <Folder className="mr-2 h-3.5 w-3.5" /> Open
                      </ContextMenuItem>
                    ) : (
                      <ContextMenuItem>
                        <Download className="mr-2 h-3.5 w-3.5" /> Download
                      </ContextMenuItem>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="grid grid-cols-3 gap-1 p-2">
            {entries.map((e) => (
              <button
                key={e.name}
                className={[
                  "flex flex-col items-center gap-1 rounded-md p-2 text-center transition-colors",
                  selected === e.name ? "bg-accent/30" : "hover:bg-accent/10",
                ].join(" ")}
                onClick={() => setSelected(selected === e.name ? null : e.name)}
                onDoubleClick={() => {
                  if (e.type === "dir") navigate(cwd === "/" ? `/${e.name}` : `${cwd}/${e.name}`);
                }}
              >
                {e.type === "dir"
                  ? <Folder className="h-8 w-8 text-amber-400" />
                  : <FileIcon className="h-8 w-8 text-muted-foreground" />}
                <span className="w-full truncate text-[10px]">{e.name}</span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Status bar */}
      <div className="flex items-center justify-between border-t border-border px-3 py-1 text-[10px] text-muted-foreground">
        <span>{entries.length} items · {fmtSize(totalSize)}</span>
        <span className="italic opacity-60">Demo — wire to gateway SFTP</span>
      </div>
    </div>
  );
}
