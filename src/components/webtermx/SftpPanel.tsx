import { Folder, File as FileIcon, ArrowUp, RefreshCw, Upload, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FileEntry {
  name: string;
  type: "dir" | "file";
  size?: number;
}

// Static mock file tree — wire to your gateway's SFTP API later.
const MOCK_TREE: Record<string, FileEntry[]> = {
  "/home/ubuntu": [
    { name: "Documents", type: "dir" },
    { name: "logs", type: "dir" },
    { name: "app.jar", type: "file", size: 18_823_120 },
    { name: "notes.txt", type: "file", size: 1432 },
    { name: "README.md", type: "file", size: 2841 },
  ],
  "/home/ubuntu/Documents": [
    { name: "report.pdf", type: "file", size: 482_124 },
    { name: "spec.md", type: "file", size: 8231 },
  ],
  "/home/ubuntu/logs": [
    { name: "app.log", type: "file", size: 2_104_993 },
    { name: "error.log", type: "file", size: 12_412 },
  ],
};

function fmtSize(n?: number) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function SftpPanel({ username }: { username: string }) {
  const [cwd, setCwd] = useState(`/home/${username || "ubuntu"}`);

  const entries = useMemo<FileEntry[]>(() => MOCK_TREE[cwd] ?? [], [cwd]);

  const goUp = () => {
    if (cwd === "/" || !cwd.includes("/")) return;
    const next = cwd.replace(/\/[^/]+$/, "") || "/";
    setCwd(next);
  };

  return (
    <div className="flex h-full flex-col bg-card text-card-foreground">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={goUp} aria-label="Up">
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Input value={cwd} onChange={(e) => setCwd(e.target.value)} className="h-7 flex-1 font-mono text-xs" />
        <Button size="sm" variant="secondary" className="h-7 gap-1 px-2 text-xs">
          <Upload className="h-3.5 w-3.5" /> Upload
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-right font-medium">Size</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-xs text-muted-foreground">Empty directory (demo data)</td></tr>
            )}
            {entries.map((e) => (
              <tr key={e.name} className="border-t border-border/60 hover:bg-accent/10">
                <td className="px-3 py-1.5">
                  <button
                    className="flex items-center gap-2 text-left"
                    onClick={() => e.type === "dir" && setCwd(cwd === "/" ? `/${e.name}` : `${cwd}/${e.name}`)}
                  >
                    {e.type === "dir" ? (
                      <Folder className="h-4 w-4 text-accent" />
                    ) : (
                      <FileIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={e.type === "dir" ? "font-medium" : ""}>{e.name}</span>
                  </button>
                </td>
                <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">{fmtSize(e.size)}</td>
                <td className="px-2 py-1.5 text-right">
                  {e.type === "file" && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Download">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        SFTP browser UI (mock). Hook to your gateway's SFTP endpoint to make it live.
      </div>
    </div>
  );
}
