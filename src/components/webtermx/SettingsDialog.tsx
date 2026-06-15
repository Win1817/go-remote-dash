import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useWebTermX } from "@/lib/webtermx/store";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: Props) {
  const { settings, updateSettings } = useWebTermX();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure the SSH gateway endpoint and terminal appearance.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {/* Connection */}
          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Connection</p>

            <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5">
              <div>
                <div className="text-sm font-medium">Demo mode</div>
                <div className="text-xs text-muted-foreground">
                  Use a fake in-browser shell instead of a real SSH gateway.
                </div>
              </div>
              <Switch
                checked={settings.demoMode}
                onCheckedChange={(v) => updateSettings({ demoMode: v })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gw">SSH gateway WebSocket URL</Label>
              <Input
                id="gw"
                placeholder="wss://ssh-gateway.example.com/ws"
                value={settings.gatewayUrl}
                onChange={(e) => updateSettings({ gatewayUrl: e.target.value })}
                disabled={settings.demoMode}
              />
              <p className="text-[11px] text-muted-foreground">
                Frames:{" "}
                <code className="font-mono">connect</code>,{" "}
                <code className="font-mono">data</code>,{" "}
                <code className="font-mono">resize</code>,{" "}
                <code className="font-mono">close</code>. See{" "}
                <code className="font-mono">src/lib/webtermx/transport.ts</code> for the full protocol.
              </p>
            </div>
          </div>

          <Separator />

          {/* Appearance */}
          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Appearance</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Theme</Label>
                <Select
                  value={settings.theme}
                  onValueChange={(v) => updateSettings({ theme: v as typeof settings.theme })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="dracula">Dracula</SelectItem>
                    <SelectItem value="solarized">Solarized Dark</SelectItem>
                    <SelectItem value="monokai">Monokai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="font">Font size</Label>
                <Input
                  id="font"
                  type="number"
                  min={10}
                  max={24}
                  value={settings.fontSize}
                  onChange={(e) => updateSettings({ fontSize: Number(e.target.value) || 14 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="scrollback">Scrollback lines</Label>
                <Input
                  id="scrollback"
                  type="number"
                  min={500}
                  max={50000}
                  step={500}
                  value={settings.scrollback ?? 5000}
                  onChange={(e) => updateSettings({ scrollback: Number(e.target.value) || 5000 })}
                />
              </div>
              <div className="flex flex-col justify-end space-y-1.5">
                <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                  <Label className="text-sm font-normal">Bell</Label>
                  <Switch
                    checked={settings.bellEnabled ?? false}
                    onCheckedChange={(v) => updateSettings({ bellEnabled: v })}
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* About */}
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">About</p>
            <p className="text-xs text-muted-foreground">
              WebTermX is a browser-based SSH client. It sends terminal I/O over WebSocket to your own SSH gateway server.{" "}
              <a
                href="https://github.com/Win1817/go-remote-dash"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2 hover:no-underline"
              >
                Source on GitHub
              </a>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
