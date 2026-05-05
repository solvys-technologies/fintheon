interface FirstTimeApiKeyPopupProps {
  open?: boolean;
  onClose?: () => void;
  visible?: boolean;
  onDismiss?: () => void;
  surface?: "desktop" | "mobile" | string;
}

export function FirstTimeApiKeyPopup({
  open,
  onClose,
  visible,
  onDismiss,
}: FirstTimeApiKeyPopupProps) {
  const isOpen = open ?? visible ?? false;
  const handleClose = onClose ?? onDismiss ?? (() => {});
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div style={{ width: 420, border: "1px solid #3f3f46", borderRadius: 8, background: "#09090b", padding: 14 }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>Add your API key</div>
        <p style={{ fontSize: 12, color: "#a1a1aa", marginBottom: 12 }}>
          Configure your key in Settings → API to use direct providers.
        </p>
        <button type="button" onClick={handleClose}>Continue</button>
      </div>
    </div>
  );
}
