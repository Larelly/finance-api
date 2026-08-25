import { describe, expect, it } from "vitest";
import { isValidMonth, monthRange, previousMonth } from "../../src/shared/time/monthRange.js";

describe("monthRange", () => {
  it("computes August 2026 range for America/Sao_Paulo (UTC-3)", () => {
    const { start, end } = monthRange("2026-08", "America/Sao_Paulo");

    expect(start.toISOString()).toBe("2026-08-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });

  it("a transaction at 2026-09-01T02:30Z falls inside the August range in America/Sao_Paulo", () => {
    const { start, end } = monthRange("2026-08", "America/Sao_Paulo");
    const occurredAt = new Date("2026-09-01T02:30:00.000Z");

    expect(occurredAt.getTime() >= start.getTime()).toBe(true);
    expect(occurredAt.getTime() < end.getTime()).toBe(true);
  });

  it("uses a semi-open interval: the first instant of the next month is excluded", () => {
    const { end } = monthRange("2026-08", "America/Sao_Paulo");
    const firstInstantOfSeptemberLocal = new Date("2026-09-01T03:00:00.000Z");

    expect(end.getTime()).toBe(firstInstantOfSeptemberLocal.getTime());
  });

  it("handles December -> January year rollover", () => {
    const { start, end } = monthRange("2026-12", "America/Sao_Paulo");
    expect(start.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("works for a UTC+ timezone as well", () => {
    const { start, end } = monthRange("2026-01", "Asia/Tokyo");
    expect(start.toISOString()).toBe("2025-12-31T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-31T15:00:00.000Z");
  });
});

describe("isValidMonth", () => {
  it("accepts well-formed months", () => {
    expect(isValidMonth("2026-08")).toBe(true);
    expect(isValidMonth("2026-01")).toBe(true);
    expect(isValidMonth("2026-12")).toBe(true);
  });

  it("rejects malformed months", () => {
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("2026-00")).toBe(false);
    expect(isValidMonth("agosto")).toBe(false);
    expect(isValidMonth("2026-8")).toBe(false);
    expect(isValidMonth("26-08")).toBe(false);
  });
});

describe("previousMonth", () => {
  it("returns the prior month within the same year", () => {
    expect(previousMonth("2026-08")).toBe("2026-07");
  });

  it("rolls back across a year boundary", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
  });
});
