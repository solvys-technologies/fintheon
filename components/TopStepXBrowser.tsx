import { useState, useRef, useEffect } from 'react';
import { X, ArrowLeft, ArrowRight, RotateCw, Home, ExternalLink, Monitor } from 'lucide-react';
import { isElectron } from '../lib/platform';

interface TopStepXBrowserProps {
  onClose: () => void;
}

export function TopStepXBrowser({ onClose }: TopStepXBrowserProps) {
  const [url, setUrl] = useState('https://www.topstepx.com');
  const [inputUrl, setInputUrl] = useState('https://www.topstepx.com');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const webviewRef = useRef<any>(null);

  // Check if running in Electron
  const inElectron = isElectron();

  // Webview navigation handlers
  useEffect(() => {
    if (!inElectron || !webviewRef.current) return;

    const webview = webviewRef.current;

    const handleDidNavigate = () => {
      setUrl(webview.getURL());
      setInputUrl(webview.getURL());
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
      setIsLoading(false);
    };

    const handleDidStartLoading = () => {
      setIsLoading(true);
    };

    const handleDidStopLoading = () => {
      setIsLoading(false);
    };

    webview.addEventListener('did-navigate', handleDidNavigate);
    webview.addEventListener('did-navigate-in-page', handleDidNavigate);
    webview.addEventListener('did-start-loading', handleDidStartLoading);
    webview.addEventListener('did-stop-loading', handleDidStopLoading);

    return () => {
      webview.removeEventListener('did-navigate', handleDidNavigate);
      webview.removeEventListener('did-navigate-in-page', handleDidNavigate);
      webview.removeEventListener('did-start-loading', handleDidStartLoading);
      webview.removeEventListener('did-stop-loading', handleDidStopLoading);
    };
  }, [inElectron]);

  const goBack = () => {
    if (webviewRef.current?.canGoBack()) {
      webviewRef.current.goBack();
    }
  };

  const goForward = () => {
    if (webviewRef.current?.canGoForward()) {
      webviewRef.current.goForward();
    }
  };

  const reload = () => {
    webviewRef.current?.reload();
  };

  const goHome = () => {
    if (webviewRef.current) {
      webviewRef.current.loadURL('https://www.topstepx.com');
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let finalUrl = inputUrl;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    if (webviewRef.current) {
      webviewRef.current.loadURL(finalUrl);
    }
    setUrl(finalUrl);
  };

  const openExternal = () => {
    window.open('https://www.topstepx.com', '_blank');
  };

  // Web app fallback - show message to use desktop app
  if (!inElectron) {
    return (
      <div className="h-full w-full flex flex-col bg-[#0a0a00] border border-[#D4AF37]/20 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="h-12 bg-[#0a0a00] border-b border-[#D4AF37]/20 flex items-center justify-between px-4 flex-shrink-0">
          <h2 className="text-sm font-semibold text-[#D4AF37]">TopStepX</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#D4AF37]/10 rounded transition-colors"
            title="Close TopStepX"
          >
            <X className="w-4 h-4 text-[#D4AF37]" />
          </button>
        </div>
        
        {/* Desktop App Required Message */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/10 flex items-center justify-center mb-4">
            <Monitor className="w-8 h-8 text-[#D4AF37]" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Desktop App Required</h3>
          <p className="text-gray-400 mb-6 max-w-md">
            TopStepX integration requires the Pulse desktop app due to browser security restrictions.
            Download the desktop app for the full trading experience with embedded TopStepX.
          </p>
          <div className="flex gap-3">
            <button
              onClick={openExternal}
              className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] text-black rounded-lg font-medium hover:bg-[#D4AF37]/90 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open TopStepX in Browser
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 text-white rounded-lg font-medium hover:bg-zinc-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Electron app - use webview
  return (
    <div className="h-full w-full flex flex-col bg-[#0a0a00] border border-[#D4AF37]/20 rounded-lg overflow-hidden">
      {/* Navigation Bar */}
      <div className="h-12 bg-[#0a0a00] border-b border-[#D4AF37]/20 flex items-center gap-2 px-3 flex-shrink-0">
        {/* Navigation buttons */}
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className={`p-1.5 rounded transition-colors ${
            canGoBack 
              ? 'hover:bg-[#D4AF37]/10 text-gray-300' 
              : 'text-gray-600 cursor-not-allowed'
          }`}
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          className={`p-1.5 rounded transition-colors ${
            canGoForward 
              ? 'hover:bg-[#D4AF37]/10 text-gray-300' 
              : 'text-gray-600 cursor-not-allowed'
          }`}
          title="Forward"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={reload}
          className="p-1.5 hover:bg-[#D4AF37]/10 rounded transition-colors text-gray-300"
          title="Reload"
        >
          <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={goHome}
          className="p-1.5 hover:bg-[#D4AF37]/10 rounded transition-colors text-gray-300"
          title="Home"
        >
          <Home className="w-4 h-4" />
        </button>

        {/* URL Bar */}
        <form onSubmit={handleUrlSubmit} className="flex-1 mx-2">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-gray-300 focus:outline-none focus:border-[#D4AF37]/50"
            placeholder="Enter URL..."
          />
        </form>

        {/* Open external & Close */}
        <button
          onClick={openExternal}
          className="p-1.5 hover:bg-[#D4AF37]/10 rounded transition-colors text-gray-300"
          title="Open in Browser"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-[#D4AF37]/10 rounded transition-colors"
          title="Close TopStepX"
        >
          <X className="w-4 h-4 text-[#D4AF37]" />
        </button>
      </div>
      
      {/* Webview Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* @ts-ignore - webview is an Electron-specific element */}
        <webview
          ref={webviewRef}
          src={url}
          className="w-full h-full"
          style={{ display: 'flex' }}
          allowpopups="true"
          partition="persist:topstepx"
        />
        
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-[#0a0a00]/80 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <RotateCw className="w-8 h-8 text-[#D4AF37] animate-spin" />
              <span className="text-sm text-gray-400">Loading TopStepX...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
