import { useEffect, useId, useState } from "react";

interface NarrativeMermaidViewProps {
  source: string;
}

export function NarrativeMermaidView({ source }: NarrativeMermaidViewProps) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!source.trim()) {
      setSvg("");
      return;
    }

    import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "dark",
          themeVariables: {
            background: "#050402",
            primaryColor: "#15120b",
            primaryBorderColor: "#c79f4a",
            primaryTextColor: "#f0ead6",
            lineColor: "#c79f4a",
            fontFamily: "Inter, sans-serif",
          },
        });
        return mermaid.render(`narrative-${id}`, source);
      })
      .then((result) => {
        if (cancelled) return;
        setSvg(result.svg);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Mermaid render failed");
      });

    return () => {
      cancelled = true;
    };
  }, [id, source]);

  if (error) {
    return (
      <pre className="h-full overflow-auto rounded-md border border-red-500/20 bg-red-500/5 p-4 text-xs text-red-200">
        {error}
      </pre>
    );
  }

  return (
    <div className="flex h-full min-h-0 items-center justify-center overflow-auto p-6">
      {svg ? (
        <div
          className="max-w-full [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]">
          Rendering chart
        </p>
      )}
    </div>
  );
}
