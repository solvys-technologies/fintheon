import { useEffect } from 'react';
import { usePsychAssistBackground } from '../hooks/usePsychAssistBackground';

/**
 * Background provider component that ensures PsychAssist data
 * is recorded persistently across all layouts and runtime
 */
export function PsychAssistBackgroundProvider() {
  const { startBackgroundMonitoring, isActive } = usePsychAssistBackground();

  useEffect(() => {
    // Auto-start background monitoring when component mounts
    // This ensures PsychAssist runs in the background across all layouts
    if (!isActive) {
      startBackgroundMonitoring().catch(err => {
        console.error('Failed to auto-start PsychAssist background monitoring:', err);
      });
    }
  }, [isActive, startBackgroundMonitoring]);

  // This component doesn't render anything - it just runs in the background
  return null;
}
