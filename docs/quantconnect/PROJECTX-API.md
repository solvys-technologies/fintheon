# ProjectX API Reference (cached from solvys-technologies/pulse)
# See full docs: gh api "repos/solvys-technologies/pulse/contents/docs/integration/PROJECTX-API.md"

## Key Details
- **Base URL:** https://api.topstepx.com/api
- **Real-Time:** https://rtc.topstepx.com/hubs (SignalR WebSocket)
- **Auth:** Bearer JWT token
- **Language:** TypeScript/JavaScript native (SignalR client)
- **MNQ Contract ID format:** CON.F.US.DA6.{EXPIRATION} (micro) or CON.F.US.ENQ.{EXPIRATION} (e-mini)

## Core Endpoints
- POST /api/Order/place — place orders (market, limit, stop, trailing, brackets)
- POST /api/Order/modify — modify open orders
- POST /api/Order/searchOpen — list open orders
- POST /api/Position/searchOpen — list positions
- POST /api/Position/closeContract — close position
- POST /api/Contract/search — search contracts
- POST /api/History/retrieveBars — OHLCV bars (50 req/30s limit)

## Real-Time Hubs
- /hubs/user — account, order, position, trade updates
- /hubs/market — quotes, trades, DOM

## Rate Limits
- History: 50 req / 30s
- All other: 200 req / 60s
