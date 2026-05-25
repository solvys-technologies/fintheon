# Sprint Brief: S76-T5 -- Weather Location Loading Screens

## Context

Mobile loading screens can feel more alive by adapting to weather and coarse location context without becoming a privacy-heavy feature.

## Scope

- Use `@sprint-md/S76-T5-weather-location-loading-screens.md` in Linear issue descriptions.
- Branch target: `sprint/S76`.
- Add dithered loading-screen variants for weather/location context.
- Keep location handling coarse and privacy-aware.
- Preserve Fintheon's Solvys Gold visual language.

## Acceptance

- Loading states can select a weather/location-aware visual variant when safe context is available.
- The fallback state works without location or weather data.
- No precise location is persisted without an explicit product decision.
- `npx tsc --noEmit --project frontend/tsconfig.json` passes.
