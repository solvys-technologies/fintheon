// [claude-code 2026-04-19] TP beta polish: full rewrite. Scrollable shell, full-width,
//   glassmorphic collapsible sections, accordion theme picker, 5-font picker, manual
//   save via a clearly-pressable SaveButton. Broken into focused modules under 300 lines.
import { useSettings } from "../../contexts/SettingsContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { CollapsibleSection } from "./CollapsibleSection";
import { ThemePickerAccordion } from "./ThemePickerAccordion";
import { FontPickerList } from "./FontPickerList";
import { NotificationsSection } from "./NotificationsSection";
import { TraderSection } from "./TraderSection";
import { SaveButton } from "./SaveButton";

export function SettingsPage() {
  const { isDirty, isSaving, saveAll } = useSettings();
  const {
    theme,
    setTheme,
    fontTheme,
    setFontTheme,
    availableThemes,
    specialThemes,
    availableFonts,
  } = useTheme();
  const { user, signOut } = useAuth();

  const trailingSave = (
    <SaveButton visible={isDirty} saving={isSaving} onSave={saveAll} />
  );

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: "16px 16px calc(96px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <CollapsibleSection
          id="notifications"
          title="Notifications"
          defaultOpen
          trailing={trailingSave}
        >
          <NotificationsSection />
        </CollapsibleSection>

        <CollapsibleSection
          id="appearance"
          title="Appearance"
          defaultOpen
          trailing={trailingSave}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <ThemePickerAccordion
              current={theme}
              onPick={setTheme}
              standard={availableThemes}
              special={specialThemes}
            />
            <FontPickerList
              current={fontTheme}
              onPick={setFontTheme}
              fonts={availableFonts}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection id="trader" title="Trader" trailing={trailingSave}>
          <TraderSection />
        </CollapsibleSection>

        <CollapsibleSection
          id="account"
          title="Account"
          subtitle={user?.email || "Not signed in"}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "var(--text-primary)",
              }}
            >
              {user?.email || "Not signed in"}
            </div>
            <button
              onClick={signOut}
              style={{
                alignSelf: "flex-start",
                padding: "10px 18px",
                background: "transparent",
                border:
                  "1px solid color-mix(in srgb, #EF4444 60%, transparent)",
                color: "#EF4444",
                fontFamily: "var(--font-data)",
                fontSize: 11,
                letterSpacing: "0.1em",
                cursor: "pointer",
                borderRadius: 8,
                minHeight: 44,
                WebkitTapHighlightColor: "transparent",
                transition: "background 200ms ease",
              }}
            >
              [SIGN OUT]
            </button>
          </div>
        </CollapsibleSection>

        <CollapsibleSection id="about" title="About">
          <div
            style={{
              color: "var(--text-disabled)",
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.08em",
              lineHeight: 1.8,
            }}
          >
            <div>FINTHEON MOBILE</div>
            <div>BUILT {import.meta.env.BUILD_TIME || "DEV"}</div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
