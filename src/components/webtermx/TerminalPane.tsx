import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { useWebTermX } from "@/lib/webtermx/store";
import { createDemoTransport, createWebSocketTransport, type Transport } from "@/lib/webtermx/transport";
import { TERMINAL_THEMES } from "@/lib/webtermx/themes";
import type { TerminalSession } from "@/lib/webtermx/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";

interface Props {
  session: TerminalSession;
  active: boolean;
}

export function TerminalPane({ session, active }: Props) {
  const { servers, settings, updateSessionStatus, reconnectSession } = useWebTermX();
  const server = servers.find((s) => s.id === session.serverId);

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const transportRef = useRef<Transport | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Mount once per session.
  useEffect(() => {
    if (!containerRef.current || !server) return;

    const term = new Terminal({
      fontSize: settings.fontSize,
      fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, Menlo, monospace',
      cursorBlink: true,
      theme: TERMINAL_THEMES[settings.theme] ?? TERMINAL_THEMES.default,
      scrollback: settings.scrollback ?? 5000,
      allowProposedApi: true,
      bellStyle: settings.bellEnabled ? "sound" : "none",
      macOptionIsMeta: true,
    });

    const fit = new FitAddon();
    const search = new SearchAddon();
    term.loadAddon(fit);
    term.loadAddon(search);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);

    requestAnimationFrame(() => {
      try { fit.fit(); } catch { /* ignore */ }
    });

    termRef.current = term;
    fitRef.current = fit;
    searchRef.current = search;

    const transport =
      settings.demoMode || !settings.gatewayUrl
        ? createDemoTransport(server)
        : createWebSocketTransport({ url: settings.gatewayUrl, profile: server });
    transportRef.current = transport;

    const offEvt = transport.onEvent((e) => {
      if (e.type === "data") term.write(e.data);
      if (e.type === "status") {
        updateSessionStatus(session.id, e.status);
        if (e.status === "error" && e.message) {
          term.write(`\r\n\x1b[31m[error]\x1b[0m ${e.message}\r\n`);
        }
        if (e.status === "closed") {
          term.write(`\r\n\x1b[33m[connection closed]\x1b[0m\r\n`);
        }
      }
    });

    const offData = term.onData((data) => transport.send(data));

    // Keyboard shortcuts inside the terminal
    const offKey = term.onKey(({ domEvent }) => {
      // Ctrl+F — open search
      if (domEvent.ctrlKey && domEvent.key === "f") {
        domEvent.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      // Ctrl+Shift+C — copy selection
      if (domEvent.ctrlKey && domEvent.shiftKey && domEvent.key === "C") {
        const sel = term.getSelection();
        if (sel) navigator.clipboard.writeText(sel).catch(() => {});
      }
    });

    const onResize = () => {
      try {
        fit.fit();
        transport.resize(term.cols, term.rows);
      } catch { /* ignore */ }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      offEvt();
      offData.dispose();
      offKey.dispose();
      try { transport.close(); } catch { /* ignore */ }
      try { term.dispose(); } catch { /* ignore */ }
      termRef.current = null;
      fitRef.current = null;
      searchRef.current = null;
      transportRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // Re-fit when becoming active.
  useEffect(() => {
    if (!active) return;
    const id = requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
        termRef.current?.focus();
        if (termRef.current && transportRef.current) {
          transportRef.current.resize(termRef.current.cols, termRef.current.rows);
        }
      } catch { /* ignore */ }
    });
    return () => cancelAnimationFrame(id);
  }, [active]);

  // Apply theme + font-size changes live.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = TERMINAL_THEMES[settings.theme] ?? TERMINAL_THEMES.default;
    term.options.fontSize = settings.fontSize;
    try { fitRef.current?.fit(); } catch { /* ignore */ }
  }, [settings.theme, settings.fontSize]);

  // Search helpers
  const doSearch = (direction: "next" | "prev") => {
    if (!searchRef.current || !searchQuery) return;
    if (direction === "next") {
      searchRef.current.findNext(searchQuery, { incremental: true, caseSensitive: false });
    } else {
      searchRef.current.findPrevious(searchQuery, { incremental: true, caseSensitive: false });
    }
  };

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery("");
    searchRef.current?.clearDecorations?.();
    termRef.current?.focus();
  };

  if (!server) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Server no longer exists.
      </div>
    );
  }

  const isTerminated = session.status === "closed" || session.status === "error";

  return (
    <div className="relative flex h-full flex-col">
      {/* In-terminal search bar */}
      {showSearch && (
        <div className="absolute right-3 top-2 z-10 flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 shadow-lg">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value) {
                searchRef.current?.findNext(e.target.value, { incremental: true, caseSensitive: false });
              } else {
                searchRef.current?.clearDecorations?.();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") doSearch(e.shiftKey ? "prev" : "next");
              if (e.key === "Escape") closeSearch();
            }}
            placeholder="Search…"
            className="h-6 w-40 border-none bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
          />
          <button onClick={() => doSearch("prev")} className="rounded p-0.5 hover:bg-accent/20" aria-label="Previous match">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => doSearch("next")} className="rounded p-0.5 hover:bg-accent/20" aria-label="Next match">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button onClick={closeSearch} className="rounded p-0.5 hover:bg-accent/20" aria-label="Close search">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Terminal canvas */}
      <div
        ref={containerRef}
        className="h-full w-full flex-1 bg-terminal"
        style={{ display: active ? "block" : "none" }}
      />

      {/* Reconnect overlay — shown when connection closed/errored */}
      {isTerminated && active && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-border/60 bg-card/90 px-4 py-2 backdrop-blur-sm">
          <span className="text-xs text-muted-foreground">
            {session.status === "error" ? "Connection failed." : "Session closed."}{" "}
            <span className="text-foreground">Reconnect to resume.</span>
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 gap-1.5 px-3 text-xs"
            onClick={() => reconnectSession(session.id)}
          >
            <RotateCcw className="h-3 w-3" />
            Reconnect
          </Button>
        </div>
      )}
    </div>
  );
}
