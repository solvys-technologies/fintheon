// [claude-code 2026-04-16] Attach button — Plus icon, no capture constraint so iOS shows full picker
import { useRef, useCallback } from "react";
import { Plus } from "lucide-react";

interface ImageAttachButtonProps {
  onAdd: (dataUri: string) => void;
  disabled?: boolean;
  imageCount: number;
}

const MAX_IMAGES = 4;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export function ImageAttachButton({
  onAdd,
  disabled,
  imageCount,
}: ImageAttachButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > MAX_SIZE_BYTES) {
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onAdd(reader.result);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [onAdd],
  );

  const isDisabled = disabled || imageCount >= MAX_IMAGES;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ display: "none" }}
      />
      <button
        onClick={handleClick}
        disabled={isDisabled}
        aria-label="Attach image"
        style={{
          background: "transparent",
          border: "none",
          padding: 6,
          cursor: isDisabled ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: isDisabled ? 0.4 : 1,
        }}
      >
        <Plus size={20} color="var(--text-secondary)" />
      </button>
    </>
  );
}
