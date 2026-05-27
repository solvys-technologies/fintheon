# Unusual Whales Level Sources

Use these endpoints for prices of interest:

- `GET /api/stock/{ticker}/greek-exposure/strike`
  - Greek exposure by strike across all contracts for a market date.
  - Useful fields: `strike`, `call_gex`, `put_gex`.
- `GET /api/stock/{ticker}/spot-exposures/strike`
  - Recent spot GEX exposures by strike, optionally filtered by `min_strike`, `max_strike`, `limit`, and `date`.
  - Useful fields: `price`, `call_gamma_oi`, `put_gamma_oi`, `call_gamma_vol`, `put_gamma_vol`.
- `GET /api/stock/{ticker}/option/stock-price-levels`
  - Call and put volume per price level.
  - Useful fields: `price`, `call_volume`, `put_volume`.
- `GET /api/stock/{ticker}/max-pain`
  - Max pain by expiry. This is a center/pin reference, not HVL.
- `GET /api/stock/{ticker}/stock-state`
  - Last source underlying state. Use only when the chart quote is not available.

Level derivation rules:

- Put Wall: largest absolute put-gamma concentration below or nearest below spot. If gamma is unavailable, use largest put-volume price level below spot.
- Call Wall: largest absolute call-gamma concentration above or nearest above spot. If gamma is unavailable, use largest call-volume price level above spot.
- HVL: nearest net gamma sign change to spot. If no sign change exists, report unavailable.
- Center Level: max pain or volume POC may be returned separately, but must not be mislabeled as HVL.

Confidence labels:

- `source`: returned directly by source as a named level.
- `derived`: calculated from GEX/volume fields.
- `fallback`: inferred from less direct data such as volume price levels or max pain.
- `unavailable`: required data was missing.
