export interface NarrativeFlowResearchInput {
  thesis?: string;
  query?: string;
  policy_theme?: string;
  drivers?: string;
  horizon?: string;
  catalyst_ids?: string;
  context?: string;
}

export interface NarrativeFlowResearchProtocol {
  skill: string;
  watchlist: string[];
  objective: string;
  steps: string[];
  outputContract: string[];
}

const watchlist = [
  "NQ",
  "ES",
  "YM",
  "RTY",
  "GC",
  "CL",
  "VIX",
  "DXY",
  "US02Y",
  "US10Y",
  "US30Y",
];

export function macro_narrative_builder(
  input: NarrativeFlowResearchInput,
): NarrativeFlowResearchProtocol {
  return buildProtocol({
    skill: "macro-narrative-builder",
    objective: `Build a falsifiable watchlist thesis for ${input.thesis ?? input.query ?? "the narrative"}.`,
    steps: [
      "State the watched-symbol thesis first.",
      "Separate macro/policy drivers from tradeable watchlist instruments.",
      "Name confirmation and invalidation evidence.",
      "Attach or request RiskFlow catalysts that prove the setup is current.",
    ],
  });
}

export function futures_catalyst_review(
  input: NarrativeFlowResearchInput,
): NarrativeFlowResearchProtocol {
  return buildProtocol({
    skill: "futures-catalyst-review",
    objective: `Rank catalysts for ${input.query ?? input.thesis ?? "the workspace"} by watchlist impact.`,
    steps: [
      "Group attached RiskFlow headlines, vault notes, and desk notes by watched symbol.",
      "Score each catalyst as confirmation, contradiction, or open question.",
      "Promote high-IV, timely, and repeated catalysts above stale mentions.",
      "Flag non-watchlist assets as drivers only.",
    ],
  });
}

export function policy_headline_cycle(
  input: NarrativeFlowResearchInput,
): NarrativeFlowResearchProtocol {
  return buildProtocol({
    skill: "policy-headline-cycle",
    objective: `Track policy cadence for ${input.policy_theme ?? input.thesis ?? "the narrative"}.`,
    steps: [
      "Map escalation, pause, denial, leak, and re-escalation beats.",
      "Tie each beat to watchlist sensitivity and session timing.",
      "Mark cycle breaks that would invalidate the cadence.",
      "Keep policy actors external unless their impact resolves to watched symbols.",
    ],
  });
}

export function risk_on_risk_off_synthesis(
  input: NarrativeFlowResearchInput,
): NarrativeFlowResearchProtocol {
  return buildProtocol({
    skill: "risk-on-risk-off-synthesis",
    objective: `Translate ${input.drivers ?? input.thesis ?? "the driver set"} into watchlist pressure.`,
    steps: [
      "Classify the read as risk-on, risk-off, rotation, or mixed.",
      "Resolve the read through equity futures, VIX, DXY, rates, gold, or crude.",
      "Use external drivers as evidence, not trade targets.",
      "State what would flip the read.",
    ],
  });
}

export function catalysts_to_watch_forward(
  input: NarrativeFlowResearchInput,
): NarrativeFlowResearchProtocol {
  return buildProtocol({
    skill: "catalysts-to-watch-forward",
    objective: `Name forward catalysts for ${input.thesis ?? input.query ?? "the narrative"}.`,
    steps: [
      "List the next headlines, data prints, speeches, positioning tells, and policy beats.",
      "Attach watched-symbol sensitivity to every forward catalyst.",
      "Mark what confirms, fades, or breaks the narrative.",
      "Avoid weekly memo framing; this is a forward watchlist for the desk.",
    ],
  });
}

function buildProtocol(params: {
  skill: string;
  objective: string;
  steps: string[];
}): NarrativeFlowResearchProtocol {
  return {
    skill: params.skill,
    watchlist,
    objective: params.objective,
    steps: params.steps,
    outputContract: [
      "Watched-symbol read",
      "Attached evidence",
      "Contradictions",
      "Catalysts to watch going forward",
      "Invalidation",
    ],
  };
}
