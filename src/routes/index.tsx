import { createFileRoute } from "@tanstack/react-router";
import { WebTermXProvider } from "@/lib/webtermx/store";
import { Sidebar } from "@/components/webtermx/Sidebar";
import { WorkspacePanel } from "@/components/webtermx/WorkspacePanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WebTermX — Browser SSH Client" },
      { name: "description", content: "Manage SSH servers, open tabbed terminals, and browse remote files from your browser." },
      { property: "og:title", content: "WebTermX — Browser SSH Client" },
      { property: "og:description", content: "A MobaXterm-style web SSH client: tabs, server inventory, SFTP, themes." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <WebTermXProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
        <Sidebar />
        <WorkspacePanel />
      </div>
    </WebTermXProvider>
  );
}
