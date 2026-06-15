export type AuthType = "password" | "key";

export interface ServerProfile {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  authType: AuthType;
  // Stored in browser localStorage — for management UI only.
  // Real credentials should be sent over WSS to your gateway, never persisted
  // on the client in production. Treat this as a dev/demo convenience.
  password?: string;
  privateKey?: string;
  passphrase?: string;
  color?: string;
  createdAt: number;
}

export type ConnectionStatus = "idle" | "connecting" | "connected" | "closed" | "error";

export interface TerminalSession {
  id: string;
  serverId: string;
  title: string;
  status: ConnectionStatus;
  createdAt: number;
}

export interface AppSettings {
  gatewayUrl: string; // e.g. wss://ssh-gateway.example.com/ws
  demoMode: boolean;
  fontSize: number;
  theme: "dracula" | "solarized" | "monokai" | "default";
}

export const DEFAULT_SETTINGS: AppSettings = {
  gatewayUrl: "",
  demoMode: true,
  fontSize: 14,
  theme: "default",
};
