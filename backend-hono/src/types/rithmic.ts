/**
 * Rithmic Types
 * Scaffold for Rithmic broker integration (Autopilot primary)
 */

export type PrimaryBroker = "rithmic" | "projectx" | "mmt";

export interface RithmicCredentials {
  /** Placeholder for future Rithmic API credentials */
  userId?: string;
  password?: string;
  systemName?: string;
  appName?: string;
}

export interface RithmicConnectionStatus {
  connected: boolean;
  message: string;
}
