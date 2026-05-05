interface PatchDiffViewerProps {
  diff: string;
  files?: string[];
}

export function PatchDiffViewer({ diff, files = [] }: PatchDiffViewerProps) {
  return (
    <div style={{ border: "1px solid #27272a", borderRadius: 6, padding: 10, marginTop: 8 }}>
      {files.length ? (
        <div style={{ fontSize: 11, color: "#a1a1aa", marginBottom: 8 }}>
          {files.join(", ")}
        </div>
      ) : null}
      <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", color: "#d4d4d8" }}>{diff || "(empty diff)"}</pre>
    </div>
  );
}
