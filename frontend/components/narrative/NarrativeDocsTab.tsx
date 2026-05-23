import { ExternalLink, FileDown } from "lucide-react";
import type {
  NarrativeWorkspaceLink,
  NarrativeWorkspaceSession,
} from "./NarrativeSessionWorkspace";
import type { SensemakingCatalyst, SensemakingResponse } from "./sensemaking-types";

interface NarrativeDocsTabProps {
  session: NarrativeWorkspaceSession | null;
  response: SensemakingResponse | null;
}

export function NarrativeDocsTab({ session, response }: NarrativeDocsTabProps) {
  const report = session?.report ?? response?.forecast?.rationale ?? response?.synthesisSummary;
  const synthesis = session?.synthesis ?? response?.synthesisSummary;
  const links = session?.webLinks ?? [];
  const catalysts = response
    ? [...response.anchorCatalysts, ...response.relatedCatalysts]
    : [];

  return (
    <div className="space-y-3">
      <section className="rounded-md border border-[var(--fintheon-accent)]/12 p-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/70">
          Report
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--fintheon-text)]/88">
          {report ?? "No report is attached to this narrative session yet."}
        </p>
      </section>

      <section className="rounded-md border border-[var(--fintheon-accent)]/12 p-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/70">
          Web Links
        </p>
        <div className="mt-2 space-y-2">
          {links.length > 0 ? (
            links.map((link) => <DocLink key={link.href} link={link} />)
          ) : (
            <p className="text-xs leading-5 text-[var(--fintheon-muted)]">
              Relevant web and report links will be listed here when the desk session provides them.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-md border border-[var(--fintheon-accent)]/12 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/70">
            Quick Share
          </p>
          <button
            type="button"
            onClick={() => printQuickShare({ session, response, links })}
            className="inline-flex h-7 items-center gap-1.5 rounded border border-[var(--fintheon-accent)]/16 px-2 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)] transition hover:border-[var(--fintheon-accent)]/36"
          >
            <FileDown size={12} />
            PDF
          </button>
        </div>
        <article className="mt-3 space-y-3 rounded-md border border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-surface)]/35 p-3">
          <header className="space-y-1 border-b border-[var(--fintheon-accent)]/10 pb-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]">
              Priced In Capital desk synthesis
            </p>
            <h3 className="text-sm font-semibold leading-5 text-[var(--fintheon-text)]">
              {session?.title ?? response?.anchorCatalysts[0]?.headline ?? "Narrative Brief"}
            </h3>
            <p className="text-[10px] text-[var(--fintheon-muted)]">
              {formatGeneratedAt(session?.generatedAt ?? response?.generatedAt)}
            </p>
          </header>

          <section>
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-accent)]/70">
              Plain read
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--fintheon-text)]/88">
              {synthesis ?? "The desk is building a plain-language summary for this narrative."}
            </p>
          </section>

          {response?.forecast ? (
            <section>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-accent)]/70">
                Forecastable
              </p>
              <p className="mt-1 text-xs font-medium leading-5 text-[var(--fintheon-text)]">
                {response.forecast.outcome}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-[var(--fintheon-muted)]">
                {Math.round(response.forecast.confidence * 100)} confidence. {response.forecast.rationale}
              </p>
            </section>
          ) : null}

          <section>
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-accent)]/70">
              Catalyst packet
            </p>
            <div className="mt-2 space-y-2">
              {catalysts.length > 0 ? (
                catalysts.slice(0, 8).map((catalyst) => (
                  <CatalystLine key={catalyst.id} catalyst={catalyst} />
                ))
              ) : (
                <p className="text-xs text-[var(--fintheon-muted)]">
                  No catalysts are attached to this brief yet.
                </p>
              )}
            </div>
          </section>
        </article>
      </section>

      <footer className="border-t border-[var(--fintheon-accent)]/10 pt-3 text-xs">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-[var(--fintheon-accent)]/75 transition hover:text-[var(--fintheon-accent)]"
        >
          Fintheon home
          <ExternalLink size={12} />
        </a>
      </footer>
    </div>
  );
}

function CatalystLine({ catalyst }: { catalyst: SensemakingCatalyst }) {
  return (
    <div className="rounded border border-[var(--fintheon-accent)]/10 px-2 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[9px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)]/70">
          {catalyst.role === "anchor" ? "Anchor" : "Notable"}
        </span>
        <span className="font-mono text-[9px] text-[var(--fintheon-muted)]">
          IV {catalyst.ivScore.toFixed(1)}
        </span>
      </div>
      <p className="line-clamp-2 text-[11px] font-medium leading-4 text-[var(--fintheon-text)]">
        {catalyst.headline}
      </p>
      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[var(--fintheon-muted)]">
        {catalyst.summary}
      </p>
    </div>
  );
}

function printQuickShare({
  session,
  response,
  links,
}: {
  session: NarrativeWorkspaceSession | null;
  response: SensemakingResponse | null;
  links: NarrativeWorkspaceLink[];
}) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100");
  if (!win) return;
  const catalysts = response ? [...response.anchorCatalysts, ...response.relatedCatalysts] : [];
  win.document.write(buildPrintableDoc({ session, response, links, catalysts }));
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 250);
}

function buildPrintableDoc({
  session,
  response,
  links,
  catalysts,
}: {
  session: NarrativeWorkspaceSession | null;
  response: SensemakingResponse | null;
  links: NarrativeWorkspaceLink[];
  catalysts: SensemakingCatalyst[];
}) {
  const title = escapeHtml(session?.title ?? response?.anchorCatalysts[0]?.headline ?? "Narrative Brief");
  const synthesis = escapeHtml(session?.synthesis ?? response?.synthesisSummary ?? "Synthesis pending.");
  const forecast = response?.forecast
    ? `<section><h2>Forecastable</h2><p><strong>${escapeHtml(response.forecast.outcome)}</strong></p><p>${Math.round(response.forecast.confidence * 100)} confidence. ${escapeHtml(response.forecast.rationale)}</p></section>`
    : "";
  const catalystRows = catalysts
    .slice(0, 12)
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.headline)}</strong><span>${item.role} | IV ${item.ivScore.toFixed(1)} | ${escapeHtml(item.source)}</span><p>${escapeHtml(item.summary)}</p></li>`,
    )
    .join("");
  const linkRows = links
    .map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`)
    .join("");
  return `<!doctype html><html><head><title>${title}</title><style>
    body{background:#050402;color:#f0ead6;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Inter",sans-serif;margin:48px}
    header{border-bottom:1px solid rgba(199,159,74,.25);padding-bottom:18px;margin-bottom:24px}
    h1{font-size:28px;line-height:1.1;margin:0 0 8px} h2{color:#c79f4a;font-size:11px;letter-spacing:.16em;text-transform:uppercase;margin:22px 0 8px}
    p{margin:0 0 10px;color:rgba(240,234,214,.86)} ul{padding:0;margin:0;list-style:none} li{border:1px solid rgba(199,159,74,.18);padding:12px;margin:8px 0}
    li span{display:block;color:rgba(240,234,214,.55);font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-top:4px}
    a{color:#c79f4a} footer{border-top:1px solid rgba(199,159,74,.2);margin-top:28px;padding-top:14px;color:rgba(240,234,214,.55);font-size:12px}
    @media print{body{background:#fff;color:#111}p,li span,footer{color:#444}h2,a{color:#7a5a17}li{border-color:#ddd}}
  </style></head><body><header><h1>${title}</h1><p>Priced In Capital desk synthesis | ${escapeHtml(formatGeneratedAt(session?.generatedAt ?? response?.generatedAt))}</p></header><section><h2>Plain Read</h2><p>${synthesis}</p></section>${forecast}<section><h2>Catalyst Packet</h2><ul>${catalystRows || "<li>No catalysts attached.</li>"}</ul></section><section><h2>Sources</h2><ul>${linkRows || "<li>Source links pending.</li>"}</ul></section><footer>Fintheon by Priced In Capital</footer></body></html>`;
}

function formatGeneratedAt(value: string | undefined) {
  if (!value) return "Generated just now";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char] ?? char;
  });
}

function DocLink({ link }: { link: NarrativeWorkspaceLink }) {
  return (
    <a
      href={link.href}
      className="flex items-center justify-between gap-3 rounded-md border border-[var(--fintheon-accent)]/10 px-2 py-2 text-xs text-[var(--fintheon-text)]/86 transition hover:border-[var(--fintheon-accent)]/32"
    >
      <span className="min-w-0">
        <span className="block truncate">{link.label}</span>
        {link.source ? (
          <span className="block truncate text-[10px] uppercase tracking-[0.1em] text-[var(--fintheon-muted)]">
            {link.source}
          </span>
        ) : null}
      </span>
      <ExternalLink size={12} className="shrink-0 text-[var(--fintheon-accent)]/70" />
    </a>
  );
}
