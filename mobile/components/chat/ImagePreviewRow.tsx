// [claude-code 2026-04-16] T2: Thumbnail preview strip for attached images
import { X } from "lucide-react";

interface ImagePreviewRowProps {
  images: string[];
  onRemove: (index: number) => void;
}

export function ImagePreviewRow({ images, onRemove }: ImagePreviewRowProps) {
  if (images.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        padding: "4px 0",
      }}
    >
      {images.map((src, i) => (
        <div
          key={i}
          style={{
            position: "relative",
            flexShrink: 0,
            width: 48,
            height: 48,
          }}
        >
          <img
            src={src}
            alt={`Attachment ${i + 1}`}
            style={{
              width: 48,
              height: 48,
              objectFit: "cover",
              borderRadius: 6,
              border: "1px solid var(--border-visible)",
            }}
          />
          <button
            onClick={() => onRemove(i)}
            aria-label={`Remove image ${i + 1}`}
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "var(--surface)",
              border: "1px solid var(--border-visible)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <X size={10} color="var(--text-secondary)" />
          </button>
        </div>
      ))}
    </div>
  );
}
