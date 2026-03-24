/**
 * Platform detection utilities
 * Detects whether the app is running in Electron or web browser
 */

export const isElectron = (): boolean => {
  // Check user agent for Electron (most reliable)
  if (typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)) {
    return true;
  }
  // Fallback to window.electron check
  return typeof window !== 'undefined' && window.electron !== undefined;
};

export const isWeb = (): boolean => {
  return !isElectron();
};

/**
 * Get platform-specific features
 */
export const getPlatformFeatures = () => ({
  // TopStepX webview embedding only works in Electron
  canEmbedTopStepX: isElectron(),
  
  // Mini widget persistence only available in Electron
  canPersistWidget: isElectron(),
  
  // Native window controls in Electron
  hasNativeControls: isElectron(),
});

/**
 * Electron API wrapper with type safety
 */
export const electronAPI = {
  toggleMiniWidget: async () => {
    if (isElectron()) {
      return window.electron?.toggleMiniWidget();
    }
  },
  
  setKeepWidgetOnClose: async (value: boolean) => {
    if (isElectron()) {
      return window.electron?.setKeepWidgetOnClose(value);
    }
  },
  
  getKeepWidgetOnClose: async (): Promise<boolean> => {
    if (isElectron()) {
      return window.electron?.getKeepWidgetOnClose() ?? false;
    }
    return false;
  },
};
