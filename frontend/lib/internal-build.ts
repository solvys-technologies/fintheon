// Internal desktop builds should run without auth or paywalls by default.
// Set VITE_INTERNAL_BUILD=false to re-enable normal gating behavior.
export const IS_INTERNAL_BUILD = import.meta.env.VITE_INTERNAL_BUILD !== 'false';

