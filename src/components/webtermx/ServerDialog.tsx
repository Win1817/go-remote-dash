import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWebTermX } from "@/lib/webtermx/store";
import type { AuthType, ServerProfile } from "@/lib/webtermx/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: ServerProfile;
}

const EMPTY = {
  name: "",
  hostname: "",
  port: 22,
  username: "",
  authType: "password" as AuthType,
  password: "",
  privateKey: "",
  passphrase: "",
};

export function ServerDialog({ open, onOpenChange, editing }: Props) {
  const { addServer, updateServer } = useWebTermX();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              name: editing.name,
              hostname: editing.hostname,
              port: editing.port,
              username: editing.username,
              authType: editing.authType,
              password: editing.password ?? "",
              privateKey: editing.privateKey ?? "",
              passphrase: editing.passphrase ?? "",
            }
          : EMPTY,
      );
    }
  }, [open, editing]);

  const save = () => {
    if (!form.name.trim() || !form.hostname.trim() || !form.username.trim()) return;
    const payload = {
      name: form.name.trim(),
      hostname: form.hostname.trim(),
      port: Number(form.port) || 22,
      username: form.username.trim(),
      authType: form.authType,
      password: form.authType === "password" ? form.password : undefined,
      privateKey: form.authType === "key" ? form.privateKey : undefined,
      passphrase: form.authType === "key" ? form.passphrase : undefined,
    };
    if (editing) {
      updateServer(editing.id, payload);
    } else {
      addServer(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit server" : "Add server"}</DialogTitle>
          <DialogDescription>
            Stored in your browser. Credentials are sent over WSS to your SSH gateway at connect time.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="prod-server" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="ubuntu" />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="hostname">Hostname</Label>
              <Input id="hostname" value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} placeholder="10.10.10.20" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="port">Port</Label>
              <Input id="port" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Authentication</Label>
            <Select value={form.authType} onValueChange={(v) => setForm({ ...form, authType: v as AuthType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="password">Password</SelectItem>
                <SelectItem value="key">SSH key</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.authType === "password" ? (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="privateKey">Private key (PEM)</Label>
                <Textarea
                  id="privateKey"
                  value={form.privateKey}
                  onChange={(e) => setForm({ ...form, privateKey: e.target.value })}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                  className="font-mono text-xs"
                  rows={5}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="passphrase">Passphrase (optional)</Label>
                <Input id="passphrase" type="password" value={form.passphrase} onChange={(e) => setForm({ ...form, passphrase: e.target.value })} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Save changes" : "Add server"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
