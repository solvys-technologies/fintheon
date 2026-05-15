interface RichTextRendererProps {
  text: string;
  className?: string;
}

export function RichTextRenderer({ text, className }: RichTextRendererProps) {
  if (!text) return null;

  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part ? <span key={i}>{part}</span> : null;
      })}
    </span>
  );
}
