# Fintheon Antilag TradingView Alert

Use `docs/tradingview/antilag-time-alert.pine` as the TradingView Pine script.

Webhook URL:

```text
https://fintheon.fly.dev/api/agent-desk/antilag/alerts
```

The alert payload includes the webhook secret from the script input. Do not commit
the secret. The live value is configured in Fly and in local `backend-hono/.env`
as `TV_ANTILAG_WEBHOOK_SECRET`.

Create the TradingView alert from the script with:

- Condition: `Fintheon Antilag Time`
- Trigger: Once Per Bar Close
- Webhook URL: the URL above
- Message: leave the alert message empty; the script calls `alert(payload, ...)`

The backend records only `NQ` alerts where `NQ` spikes and at least two of
`US02Y`, `US10Y`, and `US30Y` spike on the configured ATR multiple.
