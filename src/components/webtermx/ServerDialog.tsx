import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
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

const PRESET_COLORS = [
  "#3ddc97", "#60a5fa", "#f59e0b", "#f87171", "#a78bfa",
  "#34d399", "#fb923c", "#e879f9", "#38bdf8", "#94a3b8",
];

const EMPTY = {
  name: "",
  hostname: "",
  port: 22,
  username: "",
  authType: "password" as AuthType,
  password: "",
  privateKey: "",
  passphrase: "",
  color: PRESET_COLORS[0],
  tags: "",
};

export function ServerDialog({ open, onOpenChange, editing }: Props) {
  const { addServer, updateServer } = useWebTermX();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setErrors({});
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
              color: editing.color ?? PRESET_COLORS[0],
              tags: editing.tags?.join(", ") ?? "",
            }
          : EMPTY,
      );
    }
  }, [open, editing]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Required";
    if (!form.hostname.trim()) errs.hostname = "Required";
    if (!form.username.trim()) errs.username = "Required";
    if (!form.port || form.port < 1 || form.port > 65535) errs.port = "1–65535";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = () => {
    if (!validate()) return;
    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = {
      name: form.name.trim(),
      hostname: form.hostname.trim(),
      port: Number(form.port) || 22,
      username: form.username.trim(),
      authType: form.authType,
      password: form.authType === "password" ? form.password : undefined,
      privateKey: form.authType === "key" ? form.privateKey : undefined,
      passphrase: form.authType === "key" ? form.passphrase : undefined,
      color: form.color,
      tags: tags.length ? tags : undefined,
    };
    if (editing) {
      updateServer(editing.id, payload);
    } else {
      addServer(payload);
    }
    onOpenChange(false);
  };

  const field = (id: keyof typeof form) => ({
    value: String(form[id]),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [id]: e.target.value }),
  });

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
          {/* Name + username */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name {errors.name && <span className="text-destructive text-[10px]">{errors.name}</span>}</Label>
              <Input id="name" {...field("name")} placeholder="prod-server" className={errors.name ? "border-destructive" : ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username {errors.username && <span className="text-destructive text-[10px]">{errors.username}</span>}</Label>
              <Input id="username" {...field("username")} placeholder="ubuntu" className={errors.username ? "border-destructive" : ""} />
            </div>
          </div>

          {/* Hostname + port */}
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="hostname">Hostname / IP {errors.hostname && <span className="text-destructive text-[10px]">{errors.hostname}</span>}</Label>
              <Input id="hostname" {...field("hostname")} placeholder="10.10.10.20" className={errors.hostname ? "border-destructive" : ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="port">Port {errors.port && <span className="text-destructive text-[10px]">{errors.port}</span>}</Label>
              <Input
                id="port"
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                className={errors.port ? "border-destructive" : ""}
              />
            </div>
          </div>

          {/* Color picker */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={[
                    "h-6 w-6 rounded-full border-2 transition-transform",
                    form.color === c
                      ? "scale-125 border-foreground"
                      : "border-transparent hover:scale-110",
                  ].join(" ")}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="ml-1 h-6 w-6 cursor-pointer rounded border border-border bg-transparent p-0"
                title="Custom color"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags <span className="text-muted-foreground font-normal">(comma separated)</span></Label>
            <Input id="tags" {...field("tags")} placeholder="production, aks, linux" />
          </div>

          {/* Auth */}
          <div className="space-y-1.5">
            <Label>Authentication</Label>
            <Select
              value={form.authType}
              onValueChange={(v) => setForm({ ...form, authType: v as AuthType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="password">Password</SelectItem>
                <SelectItem value="key">SSH key (PEM)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.authType === "password" ? (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...field("password")} autoComplete="new-password" />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="privateKey">Private key (PEM)</Label>
                <Textarea
                  id="privateKey"
                  {...field("privateKey")}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                  className="font-mono text-xs"
                  rows={5}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="passphrase">Passphrase <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="passphrase" type="password" {...field("passphrase")} autoComplete="new-password" />
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
