import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";

const service = await import("../services/agent-desk/antilag-service.js");

test("classifyInstrument maps core futures groups", () => {
  assert.equal(service.classifyInstrument("NQ"), "equity-index");
  assert.equal(service.classifyInstrument("/ES"), "equity-index");
  assert.equal(service.classifyInstrument("YM"), "equity-index");
  assert.equal(service.classifyInstrument("US10Y"), "treasury");
  assert.equal(service.classifyInstrument("GC"), "commodity");
});

test("activeBusinessDates returns five rolling weekdays", () => {
  const dates = service.activeBusinessDates(
    new Date("2026-05-18T16:00:00-04:00"),
  );
  assert.deepEqual(dates, [
    "2026-05-18",
    "2026-05-15",
    "2026-05-14",
    "2026-05-13",
    "2026-05-12",
  ]);
});

test("recordTradingViewAntilagAlert records NQ plus two barometers", async () => {
  const result = await service.recordTradingViewAntilagAlert({
    userId: "system",
    payload: {
      source: "tradingview",
      eventType: "ANTILAG_TIME",
      instrument: "NQ",
      timeframe: "1",
      atrLookback: 14,
      atrMultiple: 2,
      triggeredAt: "2026-05-18T10:34:00-04:00",
      nq: { spiked: true },
      barometers: {
        US02Y: { spiked: true },
        US10Y: { spiked: true },
        US30Y: { spiked: false },
      },
    },
  });

  assert.equal(result.recorded, true);
  assert.equal(result.event?.instrument, "NQ");
  assert.equal(result.event?.barometerSpikeCount, 2);

  const summary = await service.getAntilagSummary(
    new Date("2026-05-18T15:00:00-04:00"),
  );
  assert.equal(summary.activeCount, 1);
  assert.equal(summary.latestEvent?.instrument, "NQ");
});

test("recordTradingViewAntilagAlert ignores weak or non-NQ payloads", async () => {
  const weak = await service.recordTradingViewAntilagAlert({
    userId: "system",
    payload: {
      instrument: "NQ",
      timeframe: "1",
      atrLookback: 14,
      atrMultiple: 2,
      triggeredAt: "2026-05-18T10:40:00-04:00",
      nq: { spiked: true },
      barometers: {
        US02Y: { spiked: true },
        US10Y: { spiked: false },
        US30Y: { spiked: false },
      },
    },
  });
  const es = await service.recordTradingViewAntilagAlert({
    userId: "system",
    payload: {
      instrument: "ES",
      timeframe: "1",
      triggeredAt: "2026-05-18T10:41:00-04:00",
      nq: { spiked: true },
      barometers: {
        US02Y: { spiked: true },
        US10Y: { spiked: true },
        US30Y: { spiked: true },
      },
    },
  });

  assert.equal(weak.recorded, false);
  assert.equal(es.recorded, false);
});

