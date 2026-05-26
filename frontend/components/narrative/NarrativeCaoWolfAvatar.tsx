import { Fragment, useEffect, useRef } from "react";
import "./cao-wolf-avatar.css";

interface NarrativeCaoWolfAvatarProps {
  runKey?: string | number;
}

export function NarrativeCaoWolfAvatar({
  runKey = 0,
}: NarrativeCaoWolfAvatarProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const host = root?.closest(
      ".narrative-cao-wolf-composer-host",
    ) as HTMLElement | null;
    if (!root || !host) return;
    const composerHost = host;

    const input = host.querySelector(
      ".fintheon-composer-input",
    ) as HTMLElement | null;
    if (!input) return;

    function syncComposerHeight() {
      composerHost.style.setProperty(
        "--cao-wolf-composer-height",
        `${Math.ceil(input?.getBoundingClientRect().height ?? 98)}px`,
      );
    }

    syncComposerHeight();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(syncComposerHeight)
        : null;
    observer?.observe(input);
    window.addEventListener("resize", syncComposerHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncComposerHeight);
    };
  }, []);

  return (
    <div ref={rootRef} className="narrative-cao-wolf-layer" aria-hidden="true">
      <Fragment key={runKey}>
        <div className="cao-elevator">
          <div className="cao-elevator-readout">8:18</div>
          <span className="cao-elevator-door cao-elevator-door-left" />
          <span className="cao-elevator-door cao-elevator-door-right" />
        </div>
        <div className="cao-desk" />
        <div className="cao-runner">
          <WolfSprite />
          <div className="cao-briefcase cao-carried-case" />
        </div>
        <div className="cao-air-wolf">
          <WolfSprite isAirborne />
        </div>
        <div className="cao-slam-rig">
          <span className="cao-swing-arm" />
          <span className="cao-swing-hand" />
          <span className="cao-swing-briefcase" />
        </div>
        <div className="cao-slam-case">
          <span className="cao-case-lid" />
          <span className="cao-case-laptop" />
        </div>
        <div className="cao-case-open-arm" />
        <div className="cao-impact">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="cao-peek">
          <div className="cao-peek-profile">
            <WolfSprite isSeated />
          </div>
          <div className="cao-front-peek">
            <span className="cao-front-faceplate" />
            <span className="cao-front-ear cao-front-ear-left" />
            <span className="cao-front-ear cao-front-ear-right" />
            <span className="cao-front-eye cao-front-eye-left" />
            <span className="cao-front-eye cao-front-eye-right" />
          </div>
        </div>
        <div className="cao-laptop">
          <span className="cao-laptop-lid" />
        </div>
      </Fragment>
    </div>
  );
}

function WolfSprite({
  isAirborne = false,
  isSeated = false,
}: {
  isAirborne?: boolean;
  isSeated?: boolean;
}) {
  return (
    <div
      className={`cao-wolf-sprite ${isAirborne ? "is-airborne" : ""} ${
        isSeated ? "is-seated" : ""
      }`}
    >
      <span className="cao-ear cao-ear-left" />
      <span className="cao-ear cao-ear-right" />
      <span className="cao-head" />
      <span className="cao-head-highlight" />
      <span className="cao-snout" />
      <span className="cao-nose" />
      <span className="cao-glasses cao-glasses-left" />
      <span className="cao-glasses cao-glasses-right" />
      <span className="cao-glasses-arm" />
      <span className="cao-eye" />
      <span className="cao-suit" />
      <span className="cao-shirt cao-shirt-left" />
      <span className="cao-shirt cao-shirt-right" />
      <span className="cao-tie" />
      <span className="cao-arm cao-back-arm" />
      <span className="cao-arm cao-front-arm" />
      <span className="cao-paw cao-back-paw" />
      <span className="cao-paw cao-front-paw" />
      <span className="cao-leg cao-back-leg" />
      <span className="cao-leg cao-front-leg" />
      <span className="cao-foot cao-back-foot" />
      <span className="cao-foot cao-front-foot" />
    </div>
  );
}
