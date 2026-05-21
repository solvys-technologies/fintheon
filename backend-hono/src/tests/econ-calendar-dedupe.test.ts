import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEventName } from "../services/econ-calendar-service.js";

test("normalizeEventName collapses variant capitalisation", () => {
  assert.equal(normalizeEventName("CPI Year over Year"), "cpi year over year");
  assert.equal(normalizeEventName("Cpi Year Over Year"), "cpi year over year");
  assert.equal(normalizeEventName("cpi year over year"), "cpi year over year");
  assert.equal(normalizeEventName("CPI YEAR OVER YEAR"), "cpi year over year");
});

test("normalizeEventName collapses extra whitespace", () => {
  assert.equal(normalizeEventName("  CPI  Year  over  Year  "), "cpi year over year");
  assert.equal(normalizeEventName("NFP\t(Non-Farm Payrolls)"), "nfp\t(non-farm payrolls)".replace(/\s+/g, " "));
  assert.equal(normalizeEventName("Core PCE  Price Index"), "core pce price index");
});

test("normalizeEventName variant payloads produce same identity", () => {
  const variants = [
    "US Initial Jobless Claims",
    "US Initial  Jobless Claims",
    "us initial jobless claims",
    "US INITIAL JOBLESS CLAIMS",
    "  US Initial Jobless Claims  ",
  ];
  const keys = variants.map(normalizeEventName);
  const unique = new Set(keys);
  assert.equal(unique.size, 1, `Expected 1 unique key, got: ${[...unique].join(", ")}`);
});

test("normalizeEventName preserves hyphens and parentheses", () => {
  assert.equal(normalizeEventName("Non-Farm Payrolls (NFP)"), "non-farm payrolls (nfp)");
  assert.equal(normalizeEventName("GDP (QoQ)"), "gdp (qoq)");
});
