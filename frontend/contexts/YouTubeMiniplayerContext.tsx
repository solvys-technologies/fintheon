// [claude-code 2026-04-27] S46.4/H: YouTube miniplayer context — single
// source of truth for the floating miniplayer's open/closed state and the
// currently-loaded video. RiskFlowDetailCard.openVideo(url) routes any
// commentary-category YouTube link into the floating miniplayer instead of
// a new tab. When opened with no video, the existing layout/YouTubeMiniplayer
// falls through to the Bloomberg Originals idle homepage embed.
//
// Bridge: openVideo writes the resolved video ID to localStorage
// `fintheon:yt-miniplayer-video` and dispatches a `yt-miniplayer:set-video`
// CustomEvent so the existing draggable miniplayer (which already reads from
// that key on mount) updates immediately.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { extractYouTubeVideoId } from "../lib/youtube";

const VIDEO_LS_KEY = "fintheon:yt-miniplayer-video";
const OPEN_LS_KEY = "fintheon:yt-miniplayer-open";

interface YouTubeMiniplayerValue {
  videoId: string | null;
  visible: boolean;
  /** Returns true if the URL was a YouTube link and the miniplayer opened it. */
  openVideo: (url: string) => boolean;
  /** Open the miniplayer with no specific video (falls through to idle homepage). */
  openHomepage: () => void;
  hide: () => void;
  setVisible: (open: boolean) => void;
}

const YouTubeMiniplayerContext = createContext<YouTubeMiniplayerValue>({
  videoId: null,
  visible: false,
  openVideo: () => false,
  openHomepage: () => {},
  hide: () => {},
  setVisible: () => {},
});

function readPersistedVideoId(): string | null {
  try {
    return localStorage.getItem(VIDEO_LS_KEY);
  } catch {
    return null;
  }
}

function readPersistedOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_LS_KEY) === "true";
  } catch {
    return false;
  }
}

function persistVideoId(id: string | null): void {
  try {
    if (id) localStorage.setItem(VIDEO_LS_KEY, id);
    else localStorage.removeItem(VIDEO_LS_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(
      new CustomEvent("yt-miniplayer:set-video", { detail: { videoId: id } }),
    );
  } catch {
    /* ignore */
  }
}

function persistOpen(open: boolean): void {
  try {
    localStorage.setItem(OPEN_LS_KEY, String(open));
  } catch {
    /* ignore */
  }
}

export function YouTubeMiniplayerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [videoId, setVideoIdState] = useState<string | null>(() =>
    readPersistedVideoId(),
  );
  const [visible, setVisibleState] = useState<boolean>(() =>
    readPersistedOpen(),
  );

  const setVisible = useCallback((open: boolean) => {
    setVisibleState(open);
    persistOpen(open);
  }, []);

  const openVideo = useCallback(
    (url: string) => {
      const id = extractYouTubeVideoId(url);
      if (!id) return false;
      setVideoIdState(id);
      persistVideoId(id);
      setVisible(true);
      return true;
    },
    [setVisible],
  );

  const openHomepage = useCallback(() => {
    setVideoIdState(null);
    persistVideoId(null);
    setVisible(true);
  }, [setVisible]);

  const hide = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  // Re-sync if the existing miniplayer changes the video from its UI form.
  useEffect(() => {
    function onSet(evt: Event) {
      const detail = (evt as CustomEvent<{ videoId: string | null }>).detail;
      setVideoIdState(detail?.videoId ?? null);
    }
    window.addEventListener("yt-miniplayer:set-video", onSet as EventListener);
    return () =>
      window.removeEventListener(
        "yt-miniplayer:set-video",
        onSet as EventListener,
      );
  }, []);

  const value = useMemo<YouTubeMiniplayerValue>(
    () => ({ videoId, visible, openVideo, openHomepage, hide, setVisible }),
    [videoId, visible, openVideo, openHomepage, hide, setVisible],
  );

  return (
    <YouTubeMiniplayerContext.Provider value={value}>
      {children}
    </YouTubeMiniplayerContext.Provider>
  );
}

export function useYouTubeMiniplayer(): YouTubeMiniplayerValue {
  return useContext(YouTubeMiniplayerContext);
}
