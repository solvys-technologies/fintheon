# PIC Boardroom Cron Schedule Setup

**Created:** 2026-03-19  
**Status:** Ready for deployment  
**Timezone:** America/New_York (Eastern Time)

---

## Morning Standup Schedule (Weekdays Only)

| Job Name             | Cron Expression | Time (ET) | Description                     |
| -------------------- | --------------- | --------- | ------------------------------- |
| `pic-standup-730`    | `30 7 * * 1-5`  | 7:30 AM   | Initial standup - agent wake-up |
| `pic-checkin-800`    | `0 8 * * 1-5`   | 8:00 AM   | 30 min before open              |
| `pic-checkin-830`    | `30 8 * * 1-5`  | 8:30 AM   | Economic data scan              |
| `pic-premarket-900`  | `0 9 * * 1-5`   | 9:00 AM   | Final prep, 30 min to open      |
| `pic-marketopen-930` | `30 9 * * 1-5`  | 9:30 AM   | Market open wrap                |

---

## Cron Job Setup Instructions

### Option 1: System Cron (Linux/macOS)

1. **Open crontab:**

   ```bash
   crontab -e
   ```

2. **Add these lines:**

   ```cron
   # PIC Boardroom Morning Standup (Eastern Time)
   # Note: Set TZ=America/New_York or adjust times to your local TZ

   # 7:30 AM - Initial standup
   30 7 * * 1-5 /usr/bin/curl -X POST http://localhost:8080/api/boardroom/standup/morning \
     -H "Authorization: Bearer YOUR_API_KEY" \
     >> /var/log/fintheon/boardroom-standup.log 2>&1

   # 8:00 AM - Check-in
   0 8 * * 1-5 /usr/bin/curl -X POST http://localhost:8080/api/boardroom/standup/checkin \
     -H "Authorization: Bearer YOUR_API_KEY" \
     >> /var/log/fintheon/boardroom-standup.log 2>&1

   # 8:30 AM - Economic data scan
   30 8 * * 1-5 /usr/bin/curl -X POST http://localhost:8080/api/boardroom/standup/econ-scan \
     -H "Authorization: Bearer YOUR_API_KEY" \
     >> /var/log/fintheon/boardroom-standup.log 2>&1

   # 9:00 AM - Pre-market final
   0 9 * * 1-5 /usr/bin/curl -X POST http://localhost:8080/api/boardroom/standup/premarket \
     -H "Authorization: Bearer YOUR_API_KEY" \
     >> /var/log/fintheon/boardroom-standup.log 2>&1

   # 9:30 AM - Market open wrap
   30 9 * * 1-5 /usr/bin/curl -X POST http://localhost:8080/api/boardroom/standup/market-open \
     -H "Authorization: Bearer YOUR_API_KEY" \
     >> /var/log/fintheon/boardroom-standup.log 2>&1
   ```

### Option 2: Node.js Cron (Recommended for Fintheon)

Using `node-cron` package in the backend:

```typescript
// backend-hono/src/cron/boardroom-scheduler.ts
import cron from "node-cron";
import { spawnBoardroomStandup } from "../services/boardroom-spawner.js";

// Morning standup schedule (ET)
const schedules = [
  { cron: "30 7 * * 1-5", task: "morning-standup", label: "7:30 AM Standup" },
  { cron: "0 8 * * 1-5", task: "checkin-8am", label: "8:00 AM Check-in" },
  { cron: "30 8 * * 1-5", task: "econ-scan", label: "8:30 AM Econ Scan" },
  { cron: "0 9 * * 1-5", task: "premarket", label: "9:00 AM Pre-Market" },
  { cron: "30 9 * * 1-5", task: "market-open", label: "9:30 AM Market Open" },
];

// Initialize all schedules
schedules.forEach(({ cron: cronExpr, task, label }) => {
  cron.schedule(
    cronExpr,
    async () => {
      console.log(`[Boardroom] Triggering ${label}`);
      await spawnBoardroomStandup(task);
    },
    {
      timezone: "America/New_York",
    },
  );
});
```

---

## Breaking News Trigger (Event-Driven)

The breaking news trigger is **not cron-based** — it's event-driven via Herald sentinel alerts.

**Endpoint:** `POST /api/boardroom/trigger/breaking-news`

**Payload:**

```json
{
  "eventType": "CPI",
  "macroLevel": 4,
  "headline": "CPI comes in at 2.9% YoY, below 3.1% forecast",
  "impactScore": 8.5,
  "timestamp": "2026-03-19T08:30:00-04:00"
}
```

**Integration:**

- Herald sentinel detects breaking news
- Calls webhook to trigger boardroom
- All agents wake up and comment within 60 seconds

---

## Testing

### Manual Trigger

```bash
# Test morning standup
curl -X POST http://localhost:8080/api/boardroom/standup/morning \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"

# Test breaking news trigger
curl -X POST http://localhost:8080/api/boardroom/trigger/breaking-news \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "TEST",
    "macroLevel": 4,
    "headline": "Test alert - boardroom wake-up",
    "impactScore": 5
  }'
```

### Verify in UI

1. Open Fintheon app
2. Navigate to Concilium → Boardroom
3. Watch for messages at scheduled times
4. Check session files: `backend-hono/src/sessions/pic-boardroom-*.jsonl`

---

## Next Steps

1. ✅ Files created: `boardroom-cron.ts`, `boardroom-news-trigger.ts`
2. ⏳ Backend routes to be added: `POST /api/boardroom/standup/*`
3. ⏳ Cron scheduler to be enabled in backend
4. ⏳ API key generation for cron authentication

**Owner:** Codi (Dev)  
**Priority:** High (needed for Monday market open)
