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
      className="fintheon-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        className="fintheon-modal-surface"
        style={{
          width: 420,
          padding: 14,
        }}
      >
        <div style={{ fontSize: 14, marginBottom: 8 }}>Add your API key</div>
        <p style={{ fontSize: 12, color: "#a1a1aa", marginBottom: 12 }}>
          Configure your key in Settings → API to use direct providers.
        </p>
        <button
          type="button"
          onClick={handleClose}
          style={{
            padding: "8px 12px",
            border: "1px solid var(--fintheon-accent)",
            borderRadius: 4,
            background: "var(--fintheon-accent)",
            color: "var(--fintheon-bg)",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
