export type ThemeStatus = "Active" | "Decaying" | "Resolved";

export interface ThemeTrajectoryPoint {
  timestamp: string;
  ipv: number;
}

export interface Theme {
  id: string;
  name: string;
  ipv: number;
  status: ThemeStatus;
  catalystIds: string[];
  createdAt: string;
  updatedAt: string;
  trajectory: ThemeTrajectoryPoint[];
}
