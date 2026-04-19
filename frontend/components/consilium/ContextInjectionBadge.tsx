// [claude-code 2026-04-19] S25-T7: Inline 4-dot badge on Hermes/Harper responses showing which prompt blocks were injected (feed, dossier, memoryBank, thoughtBank). Each dot is green when present, red when missing. Hover shows the full audit. Backend supplies metadata.injections on HermesChatResponse.

interface InjectionAudit {
  feed: boolean;
  dossier: boolean;
  memoryBank: boolean;
  thoughtBank: boolean;
  reflect?: boolean;
}

interface ContextInjectionBadgeProps {
  injections: InjectionAudit;
}

const DOT_SPEC: { key: keyof InjectionAudit; label: string; letter: string }[] =
  [
    { key: "feed", label: "RiskFlow feed", letter: "F" },
    { key: "dossier", label: "Agent dossier", letter: "D" },
    { key: "memoryBank", label: "Memory bank", letter: "M" },
    { key: "thoughtBank", label: "Thought bank", letter: "T" },
  ];

export function ContextInjectionBadge({
  injections,
}: ContextInjectionBadgeProps) {
  const allOk = DOT_SPEC.every((d) => injections[d.key] === true);
  const tip = DOT_SPEC.map(
    (d) => `${d.letter} ${d.label}: ${injections[d.key] ? "ok" : "missing"}`,
  ).join("\n");

  return (
    <span
      className="inline-flex items-center gap-0.5 align-middle"
      title={tip + (allOk ? "" : "\nRerun if missing context is unexpected.")}
    >
      {DOT_SPEC.map((d) => {
        const present = injections[d.key] === true;
        return (
          <span
            key={d.key}
            aria-label={`${d.label}: ${present ? "present" : "missing"}`}
            className="w-[5px] h-[5px] rounded-full"
            style={{
              backgroundColor: present
                ? "var(--fintheon-low)"
                : "var(--fintheon-severe)",
              opacity: present ? 0.85 : 0.9,
            }}
          />
        );
      })}
    </span>
  );
}
