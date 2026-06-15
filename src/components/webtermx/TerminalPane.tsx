import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useWebTermX } from "@/lib/webtermx/store";
import { createDemoTransport, createWebSocketTransport, type Transport } from "@/lib/webtermx/transport";
import { TERMINAL_THEMES } from "@/lib/webtermx/themes";
import type { TerminalSession } from "@/lib/webtermx/types";

interface Props {
  session: TerminalSession;
  active: boolean;
}

export function TerminalPane({ session, active }: Props) {
  const { servers, settings, updateSessionStatus } = useWebTermX();
  const server = servers.find((s) => s.id === session.serverId);

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const transportRef = useRef<Transport | null>(null);

  // Mount once per session.
  useEffect(() => {
    if (!containerRef.current || !server) return;

    const term = new Terminal({
      fontSize: settings.fontSize,
      fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, Menlo, monospace',
      cursorBlink: true,
      theme: TERMINAL_THEMES[settings.theme] ?? TERMINAL_THEMES.default,
      scrollback: 5000,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    requestAnimationFrame(() => {
      try { fit.fit(); } catch { /* ignore */ }
    });

    termRef.current = term;
    fitRef.current = fit;

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
      try { transport.close(); } catch { /* ignore */ }
      try { term.dispose(); } catch { /* ignore */ }
      termRef.current = null;
      fitRef.current = null;
      transportRef.current = null;
    };
    // We intentionally only re-init when the session id changes.
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

  if (!server) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Server no longer exists.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-terminal"
      style={{ display: active ? "block" : "none" }}
    />
  );
}
