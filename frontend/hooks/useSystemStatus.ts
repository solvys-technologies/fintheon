// [claude-code 2026-03-22] Convenience re-export for SystemStatusContext

import { useContext } from "react";
import {
  SystemStatusContext,
  type SystemStatusValue,
} from "../contexts/SystemStatusContext";

export function useSystemStatus(): SystemStatusValue {
  return useContext(SystemStatusContext);
}
