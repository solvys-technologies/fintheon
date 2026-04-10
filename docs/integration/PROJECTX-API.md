# ProjectX (TopStepX) API Documentation

> **Official API documentation for TopStepX trading platform integration**

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Rate Limits](#rate-limits)
- [Order Management](#order-management)
  - [Place Order](#place-order)
  - [Modify Order](#modify-order)
  - [Search Open Orders](#search-open-orders)
- [Position Management](#position-management)
  - [Search Open Positions](#search-open-positions)
  - [Close Position](#close-position)
- [Contract Management](#contract-management)
  - [Search Contracts](#search-contracts)
  - [Search Contract by ID](#search-contract-by-id)
  - [List Available Contracts](#list-available-contracts)
- [Historical Data](#historical-data)
  - [Retrieve Bars](#retrieve-bars)
- [Real-Time Data](#real-time-data)
  - [Overview](#real-time-overview)
  - [User Hub](#user-hub)
  - [Market Hub](#market-hub)
  - [Event Payloads](#event-payloads)
- [Enums & Types](#enums--types)

---

## Overview

The ProjectX API provides programmatic access to trading operations, account management, market data, and real-time updates via SignalR WebSocket connections.

**Base URL:** `https://api.topstepx.com/api`  
**Real-Time URL:** `https://rtc.topstepx.com/hubs`

---

## Authentication

All API requests require authentication via Bearer token (JWT). Include the token in the `Authorization` header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Note:** Unauthenticated requests will return HTTP 401.

---

## Rate Limits

The Gateway API employs rate limiting to ensure fair usage and system stability.

| Endpoint(s)                      | Limit                     |
| -------------------------------- | ------------------------- |
| `POST /api/History/retrieveBars` | 50 requests / 30 seconds  |
| All other endpoints              | 200 requests / 60 seconds |

### Handling Rate Limits

If you exceed rate limits, the API returns **HTTP 429 Too Many Requests**. You should:

1. Reduce request frequency
2. Implement exponential backoff
3. Retry after a short delay

---

## Order Management

### Place Order

**Endpoint:** `POST /api/Order/place`

**Description:** Place a new trading order.

**Request Body:**

```typescript
{
  accountId: number;           // Required: The account ID
  contractId: string;           // Required: The contract ID (e.g., "CON.F.US.DA6.M25")
  type: OrderType;             // Required: Order type (see Enums)
  side: OrderSide;             // Required: 0 = Bid (buy), 1 = Ask (sell)
  size: number;                // Required: Order size
  limitPrice?: number;          // Optional: Limit price (for limit orders)
  stopPrice?: number;          // Optional: Stop price (for stop orders)
  trailPrice?: number;         // Optional: Trail price (for trailing stop)
  customTag?: string;          // Optional: Unique tag across account
  stopLossBracket?: {          // Optional: Stop loss bracket
    ticks: number;
    type: OrderType;
  };
  takeProfitBracket?: {        // Optional: Take profit bracket
    ticks: number;
    type: OrderType;
  };
}
```

**Order Types:**

- `1` = Limit
- `2` = Market
- `4` = Stop
- `5` = TrailingStop
- `6` = JoinBid
- `7` = JoinAsk

**Response:**

```typescript
{
  orderId: number;
  success: boolean;
  errorCode: number;
  errorMessage: string | null;
}
```

**Example Request:**

```bash
curl -X 'POST' \
  'https://api.topstepx.com/api/Order/place' \
  -H 'accept: text/plain' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "accountId": 465,
    "contractId": "CON.F.US.DA6.M25",
    "type": 2,
    "side": 1,
    "size": 1,
    "stopLossBracket": {
      "ticks": 10,
      "type": 1
    },
    "takeProfitBracket": {
      "ticks": 20,
      "type": 1
    }
  }'
```

---

### Modify Order

**Endpoint:** `POST /api/Order/modify`

**Description:** Modify an existing open order.

**Request Body:**

```typescript
{
  accountId: number;           // Required: The account ID
  orderId: number;             // Required: The order ID to modify
  size?: number;               // Optional: New order size
  limitPrice?: number;         // Optional: New limit price
  stopPrice?: number;          // Optional: New stop price
  trailPrice?: number;         // Optional: New trail price
}
```

**Response:**

```typescript
{
  success: boolean;
  errorCode: number;
  errorMessage: string | null;
}
```

**Example Request:**

```bash
curl -X 'POST' \
  'https://api.topstepx.com/api/Order/modify' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "accountId": 465,
    "orderId": 26974,
    "size": 1,
    "stopPrice": 1604
  }'
```

---

### Search Open Orders

**Endpoint:** `POST /api/Order/searchOpen`

**Description:** Search for all open orders for an account.

**Request Body:**

```typescript
{
  accountId: number; // Required: The account ID
}
```

**Response:**

```typescript
{
  orders: Array<{
    id: number;
    accountId: number;
    contractId: string;
    creationTimestamp: string;
    updateTimestamp: string;
    status: OrderStatus;
    type: OrderType;
    side: OrderSide;
    size: number;
    limitPrice: number | null;
    stopPrice: number | null;
    filledPrice: number | null;
  }>;
  success: boolean;
  errorCode: number;
  errorMessage: string | null;
}
```

**Example Request:**

```bash
curl -X 'POST' \
  'https://api.topstepx.com/api/Order/searchOpen' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "accountId": 212
  }'
```

---

## Position Management

### Search Open Positions

**Endpoint:** `POST /api/Position/searchOpen`

**Description:** Search for all open positions for an account.

**Request Body:**

```typescript
{
  accountId: number; // Required: The account ID
}
```

**Response:**

```typescript
{
  positions: Array<{
    id: number;
    accountId: number;
    contractId: string;
    creationTimestamp: string;
    type: PositionType; // 1 = Long, 2 = Short
    size: number;
    averagePrice: number;
  }>;
  success: boolean;
  errorCode: number;
  errorMessage: string | null;
}
```

**Example Request:**

```bash
curl -X 'POST' \
  'https://api.topstepx.com/api/Position/searchOpen' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "accountId": 536
  }'
```

---

### Close Position

**Endpoint:** `POST /api/Position/closeContract`

**Description:** Close an open position.

**Request Body:**

```typescript
{
  accountId: number; // Required: The account ID
  contractId: string; // Required: The contract ID to close
}
```

**Response:**

```typescript
{
  success: boolean;
  errorCode: number;
  errorMessage: string | null;
}
```

**Example Request:**

```bash
curl -X 'POST' \
  'https://api.topstepx.com/api/Position/closeContract' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "accountId": 536,
    "contractId": "CON.F.US.GMET.J25"
  }'
```

---

## Contract Management

### Search Contracts

**Endpoint:** `POST /api/Contract/search`

**Description:** Search for contracts by name. Returns up to 20 contracts per request.

**Request Body:**

```typescript
{
  searchText: string; // Required: Contract name to search (e.g., "NQ")
  live: boolean; // Required: Search sim/live contracts
}
```

**Response:**

```typescript
{
  contracts: Array<{
    id: string; // Contract ID (e.g., "CON.F.US.ENQ.U25")
    name: string; // Contract name (e.g., "NQU5")
    description: string; // Full description
    tickSize: number; // Minimum price increment
    tickValue: number; // Dollar value per tick
    activeContract: boolean; // Whether contract is currently active
    symbolId: string; // Symbol ID (e.g., "F.US.ENQ")
  }>;
  success: boolean;
  errorCode: number;
  errorMessage: string | null;
}
```

**Example Request:**

```bash
curl -X 'POST' \
  'https://api.topstepx.com/api/Contract/search' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "live": false,
    "searchText": "NQ"
  }'
```

---

### Search Contract by ID

**Endpoint:** `POST /api/Contract/searchById`

**Description:** Get contract details by contract ID.

**Request Body:**

```typescript
{
  contractId: string; // Required: The contract ID
}
```

**Response:**

```typescript
{
  contract: {
    id: string;
    name: string;
    description: string;
    tickSize: number;
    tickValue: number;
    activeContract: boolean;
    symbolId: string;
  }
  success: boolean;
  errorCode: number;
  errorMessage: string | null;
}
```

**Example Request:**

```bash
curl -X 'POST' \
  'https://api.topstepx.com/api/Contract/searchById' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "contractId": "CON.F.US.ENQ.H25"
  }'
```

---

### List Available Contracts

**Endpoint:** `POST /api/Contract/available`

**Description:** List all available contracts for sim or live trading.

**Request Body:**

```typescript
{
  live: boolean; // Required: true for live, false for sim
}
```

**Response:**

```typescript
{
  contracts: Array<{
    id: string;
    name: string;
    description: string;
    tickSize: number;
    tickValue: number;
    activeContract: boolean;
    symbolId: string;
  }>;
  success: boolean;
  errorCode: number;
  errorMessage: string | null;
}
```

**Example Request:**

```bash
curl -X 'POST' \
  'https://api.topstepx.com/api/Contract/available' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "live": true
  }'
```

---

## Historical Data

### Retrieve Bars

**Endpoint:** `POST /api/History/retrieveBars`

**Description:** Retrieve historical bar/candlestick data. Maximum 20,000 bars per request.

**Request Body:**

```typescript
{
  contractId: string; // Required: The contract ID
  live: boolean; // Required: Use sim or live data
  startTime: string; // Required: ISO 8601 datetime (e.g., "2024-12-01T00:00:00Z")
  endTime: string; // Required: ISO 8601 datetime
  unit: number; // Required: Time unit (see below)
  unitNumber: number; // Required: Number of units per bar
  limit: number; // Required: Max bars to retrieve
  includePartialBar: boolean; // Required: Include current incomplete bar
}
```

**Time Units:**

- `1` = Second
- `2` = Minute
- `3` = Hour
- `4` = Day
- `5` = Week
- `6` = Month

**Response:**

```typescript
{
  bars: Array<{
    t: string; // Timestamp (ISO 8601)
    o: number; // Open price
    h: number; // High price
    l: number; // Low price
    c: number; // Close price
    v: number; // Volume
  }>;
  success: boolean;
  errorCode: number;
  errorMessage: string | null;
}
```

**Example Request:**

```bash
curl -X 'POST' \
  'https://api.topstepx.com/api/History/retrieveBars' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "contractId": "CON.F.US.RTY.Z24",
    "live": false,
    "startTime": "2024-12-01T00:00:00Z",
    "endTime": "2024-12-31T21:00:00Z",
    "unit": 3,
    "unitNumber": 1,
    "limit": 7,
    "includePartialBar": false
  }'
```

---

## Real-Time Data

### Real-Time Overview

The ProjectX Real-Time API uses **SignalR** (WebSocket) to provide real-time updates for accounts, orders, positions, balances, and market data.

**SignalR Hubs:**

- **User Hub** (`/hubs/user`): Account, order, position, and trade updates
- **Market Hub** (`/hubs/market`): Market data (quotes, trades, depth of market)

**What is SignalR?**

SignalR is a Microsoft framework that simplifies real-time web communication. It:

- Supports multiple transport protocols (WebSockets, SSE, Long Polling)
- Handles connection management and message routing
- Automatically selects the best transport mechanism
- Provides automatic reconnection capabilities

**Further Reading:** [SignalR Documentation](https://learn.microsoft.com/en-us/aspnet/core/signalr/introduction)

---

### User Hub

**Connection URL:** `https://rtc.topstepx.com/hubs/user?access_token=YOUR_JWT_TOKEN`

**Subscribe Methods:**

- `SubscribeAccounts()` - Subscribe to account updates
- `SubscribeOrders(accountId)` - Subscribe to order updates for account
- `SubscribePositions(accountId)` - Subscribe to position updates for account
- `SubscribeTrades(accountId)` - Subscribe to trade updates for account

**Unsubscribe Methods:**

- `UnsubscribeAccounts()`
- `UnsubscribeOrders(accountId)`
- `UnsubscribePositions(accountId)`
- `UnsubscribeTrades(accountId)`

**Event Handlers:**

- `GatewayUserAccount` - Account updates
- `GatewayUserOrder` - Order updates
- `GatewayUserPosition` - Position updates
- `GatewayUserTrade` - Trade execution updates

**Example Implementation (JavaScript/TypeScript):**

```typescript
import { HubConnectionBuilder, HttpTransportType } from "@microsoft/signalr";

function setupUserHub() {
  const JWT_TOKEN = "your_bearer_token";
  const SELECTED_ACCOUNT_ID = 123;
  const userHubUrl = `https://rtc.topstepx.com/hubs/user?access_token=${JWT_TOKEN}`;

  const connection = new HubConnectionBuilder()
    .withUrl(userHubUrl, {
      skipNegotiation: true,
      transport: HttpTransportType.WebSockets,
      accessTokenFactory: () => JWT_TOKEN,
      timeout: 10000,
    })
    .withAutomaticReconnect()
    .build();

  connection
    .start()
    .then(() => {
      // Subscribe to updates
      connection.invoke("SubscribeAccounts");
      connection.invoke("SubscribeOrders", SELECTED_ACCOUNT_ID);
      connection.invoke("SubscribePositions", SELECTED_ACCOUNT_ID);
      connection.invoke("SubscribeTrades", SELECTED_ACCOUNT_ID);

      // Handle events
      connection.on("GatewayUserAccount", (data) => {
        console.log("Account update:", data);
      });

      connection.on("GatewayUserOrder", (data) => {
        console.log("Order update:", data);
      });

      connection.on("GatewayUserPosition", (data) => {
        console.log("Position update:", data);
      });

      connection.on("GatewayUserTrade", (data) => {
        console.log("Trade update:", data);
      });

      // Reconnect handler
      connection.onreconnected((connectionId) => {
        console.log("Reconnected:", connectionId);
        // Re-subscribe on reconnect
        connection.invoke("SubscribeAccounts");
        connection.invoke("SubscribeOrders", SELECTED_ACCOUNT_ID);
        connection.invoke("SubscribePositions", SELECTED_ACCOUNT_ID);
        connection.invoke("SubscribeTrades", SELECTED_ACCOUNT_ID);
      });
    })
    .catch((err) => {
      console.error("Connection error:", err);
    });
}
```

---

### Market Hub

**Connection URL:** `https://rtc.topstepx.com/hubs/market?access_token=YOUR_JWT_TOKEN`

**Subscribe Methods:**

- `SubscribeContractQuotes(contractId)` - Subscribe to quote updates
- `SubscribeContractTrades(contractId)` - Subscribe to trade updates
- `SubscribeContractMarketDepth(contractId)` - Subscribe to depth of market (DOM)

**Unsubscribe Methods:**

- `UnsubscribeContractQuotes(contractId)`
- `UnsubscribeContractTrades(contractId)`
- `UnsubscribeContractMarketDepth(contractId)`

**Event Handlers:**

- `GatewayQuote(contractId, data)` - Quote updates
- `GatewayTrade(contractId, data)` - Market trade updates
- `GatewayDepth(contractId, data)` - Depth of market updates

**Example Implementation (JavaScript/TypeScript):**

```typescript
import { HubConnectionBuilder, HttpTransportType } from "@microsoft/signalr";

function setupMarketHub() {
  const JWT_TOKEN = "your_bearer_token";
  const marketHubUrl = `https://rtc.topstepx.com/hubs/market?access_token=${JWT_TOKEN}`;
  const CONTRACT_ID = "CON.F.US.RTY.H25";

  const connection = new HubConnectionBuilder()
    .withUrl(marketHubUrl, {
      skipNegotiation: true,
      transport: HttpTransportType.WebSockets,
      accessTokenFactory: () => JWT_TOKEN,
      timeout: 10000,
    })
    .withAutomaticReconnect()
    .build();

  connection
    .start()
    .then(() => {
      // Subscribe to market data
      connection.invoke("SubscribeContractQuotes", CONTRACT_ID);
      connection.invoke("SubscribeContractTrades", CONTRACT_ID);
      connection.invoke("SubscribeContractMarketDepth", CONTRACT_ID);

      // Handle events
      connection.on("GatewayQuote", (contractId, data) => {
        console.log("Quote update:", contractId, data);
      });

      connection.on("GatewayTrade", (contractId, data) => {
        console.log("Market trade:", contractId, data);
      });

      connection.on("GatewayDepth", (contractId, data) => {
        console.log("DOM update:", contractId, data);
      });

      // Reconnect handler
      connection.onreconnected((connectionId) => {
        console.log("Reconnected:", connectionId);
        // Re-subscribe on reconnect
        connection.invoke("SubscribeContractQuotes", CONTRACT_ID);
        connection.invoke("SubscribeContractTrades", CONTRACT_ID);
        connection.invoke("SubscribeContractMarketDepth", CONTRACT_ID);
      });
    })
    .catch((err) => {
      console.error("Connection error:", err);
    });
}
```

---

### Event Payloads

#### User Hub Events

##### GatewayUserAccount

Account balance and status updates.

```typescript
{
  id: number; // Account ID
  name: string; // Account name
  balance: number; // Current balance
  canTrade: boolean; // Trading eligibility
  isVisible: boolean; // Visibility flag
  simulated: boolean; // Sim vs live account
}
```

##### GatewayUserPosition

Position updates (open/closed positions).

```typescript
{
  id: number; // Position ID
  accountId: number; // Account ID
  contractId: string; // Contract ID
  creationTimestamp: string; // ISO 8601 timestamp
  type: PositionType; // 1 = Long, 2 = Short
  size: number; // Position size
  averagePrice: number; // Average entry price
}
```

##### GatewayUserOrder

Order status updates (open, filled, cancelled, etc.).

```typescript
{
  id: number; // Order ID
  accountId: number; // Account ID
  contractId: string; // Contract ID
  symbolId: string; // Symbol ID
  creationTimestamp: string; // ISO 8601 timestamp
  updateTimestamp: string; // ISO 8601 timestamp
  status: OrderStatus; // Order status (see Enums)
  type: OrderType; // Order type (see Enums)
  side: OrderSide; // 0 = Bid, 1 = Ask
  size: number; // Order size
  limitPrice: number | null; // Limit price
  stopPrice: number | null; // Stop price
  fillVolume: number; // Filled volume
  filledPrice: number | null; // Fill price
  customTag: string | null; // Custom tag
}
```

##### GatewayUserTrade

Trade execution updates.

```typescript
{
  id: number; // Trade ID
  accountId: number; // Account ID
  contractId: string; // Contract ID
  creationTimestamp: string; // ISO 8601 timestamp
  price: number; // Execution price
  profitAndLoss: number; // P&L for the trade
  fees: number; // Trading fees
  side: OrderSide; // 0 = Bid, 1 = Ask
  size: number; // Trade size
  voided: boolean; // Whether trade was voided
  orderId: number; // Associated order ID
}
```

#### Market Hub Events

##### GatewayQuote

Market quote updates (bid/ask, last price, volume, etc.).

```typescript
{
  symbol: string; // Symbol ID (e.g., "F.US.EP")
  symbolName: string; // Friendly name (currently unused)
  lastPrice: number; // Last traded price
  bestBid: number; // Current best bid
  bestAsk: number; // Current best ask
  change: number; // Price change since previous close
  changePercent: number; // Percent change
  open: number; // Opening price
  high: number; // Session high
  low: number; // Session low
  volume: number; // Total volume
  lastUpdated: string; // ISO 8601 timestamp
  timestamp: string; // Quote timestamp
}
```

##### GatewayDepth

Depth of Market (DOM) updates.

```typescript
{
  timestamp: string; // ISO 8601 timestamp
  type: DomType; // DOM type (see Enums)
  price: number; // Price level
  volume: number; // Total volume at price level
  currentVolume: number; // Current volume at price level
}
```

##### GatewayTrade

Market trade events (public trades, not user-specific).

```typescript
{
  symbolId: string; // Symbol ID
  price: number; // Trade price
  timestamp: string; // ISO 8601 timestamp
  type: TradeLogType; // 0 = Buy, 1 = Sell
  volume: number; // Trade volume
}
```

---

## Enums & Types

### OrderType

```typescript
enum OrderType {
  Unknown = 0,
  Limit = 1,
  Market = 2,
  StopLimit = 3,
  Stop = 4,
  TrailingStop = 5,
  JoinBid = 6,
  JoinAsk = 7,
}
```

### OrderSide

```typescript
enum OrderSide {
  Bid = 0, // Buy
  Ask = 1, // Sell
}
```

### OrderStatus

```typescript
enum OrderStatus {
  None = 0,
  Open = 1,
  Filled = 2,
  Cancelled = 3,
  Expired = 4,
  Rejected = 5,
  Pending = 6,
}
```

### PositionType

```typescript
enum PositionType {
  Undefined = 0,
  Long = 1,
  Short = 2,
}
```

### TradeLogType

```typescript
enum TradeLogType {
  Buy = 0,
  Sell = 1,
}
```

### DomType

```typescript
enum DomType {
  Unknown = 0,
  Ask = 1,
  Bid = 2,
  BestAsk = 3,
  BestBid = 4,
  Trade = 5,
  Reset = 6,
  Low = 7,
  High = 8,
  NewBestBid = 9,
  NewBestAsk = 10,
  Fill = 11,
}
```

---

## Error Handling

### Common Error Codes

- **401 Unauthorized**: Invalid or missing authentication token
- **429 Too Many Requests**: Rate limit exceeded
- **400 Bad Request**: Invalid request parameters
- **500 Internal Server Error**: Server-side error

### Error Response Format

```typescript
{
  success: false;
  errorCode: number;
  errorMessage: string;
}
```

---

## Best Practices

1. **Authentication**: Always include the Bearer token in the Authorization header
2. **Rate Limiting**: Implement exponential backoff when receiving 429 errors
3. **Real-Time Connections**: Use automatic reconnection and re-subscribe on reconnect
4. **Error Handling**: Always check the `success` field and handle `errorMessage` appropriately
5. **Contract IDs**: Use the full contract ID format (e.g., `CON.F.US.EP.U25`)
6. **Timestamps**: Use ISO 8601 format for all datetime fields
7. **Connection Management**: Properly unsubscribe and close connections when done

---

## Integration Notes

- All endpoints require authentication
- Real-time updates require SignalR WebSocket connections
- Contract IDs follow the format: `CON.F.US.{SYMBOL}.{EXPIRATION}`
- Symbol IDs follow the format: `F.US.{SYMBOL}`
- All prices are in decimal format
- All timestamps are in ISO 8601 format (UTC)

---

**Last Updated:** 2025-01-XX  
**API Version:** Current as of ProjectX documentation provided
