import { describe, expect, it } from "vitest";
import {
  autoGrouping,
  fillSeriesBuckets,
  resolveMonthlyPoints,
  toSeriesPoints,
} from "./series";

function d(iso: string): Date {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

describe("autoGrouping", () => {
  it("uses days for ranges up to ~1 year", () => {
    expect(autoGrouping(d("2026-01-01"), d("2026-08-24"))).toBe("day");
  });

  it("uses months beyond 400 days", () => {
    expect(autoGrouping(d("2024-01-01"), d("2026-08-24"))).toBe("month");
  });
});

describe("monthly bar buckets", () => {
  it("sums daily rows into calendar months and fills empty months", () => {
    const rows = [
      { id: 1, datum: d("2026-01-05"), betrag: -10 },
      { id: 2, datum: d("2026-01-20"), betrag: -15 },
      { id: 3, datum: d("2026-03-01"), betrag: 40 },
      { id: 4, datum: d("2026-03-01"), betrag: -5 },
    ];
    const points = toSeriesPoints(
      fillSeriesBuckets(d("2026-01-01"), d("2026-03-15"), "month", rows, new Set()),
      "month",
    );
    expect(points.map((p) => p.period)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(points[0]).toMatchObject({ income: "0.00", expense: "25.00" });
    expect(points[1]).toMatchObject({ income: "0.00", expense: "0.00" });
    expect(points[2]).toMatchObject({ income: "40.00", expense: "5.00" });
  });

  it("drops netted ids from monthly totals", () => {
    const rows = [
      { id: 1, datum: d("2026-06-02"), betrag: -80 },
      { id: 2, datum: d("2026-06-02"), betrag: -80 },
    ];
    const points = toSeriesPoints(
      fillSeriesBuckets(
        d("2026-06-01"),
        d("2026-06-30"),
        "month",
        rows,
        new Set([2]),
      ),
      "month",
    );
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ expense: "80.00" });
  });

  it("puts investment buys into invested and still into expense", () => {
    const rows = [
      { id: 1, datum: d("2026-04-03"), betrag: -100, isInvestment: true },
      { id: 2, datum: d("2026-04-10"), betrag: -40, isInvestment: false },
    ];
    const points = toSeriesPoints(
      fillSeriesBuckets(d("2026-04-01"), d("2026-04-30"), "month", rows, new Set()),
      "month",
    );
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({
      expense: "140.00",
      invested: "100.00",
    });
  });
});

describe("resolveMonthlyPoints", () => {
  it("rolls daily trend points into calendar months when monthlyPoints is missing", () => {
    const points = resolveMonthlyPoints({
      grouping: "day",
      points: [
        { period: "2026-01-31", label: "31.01.", income: "10.00", expense: "2.00", invested: "0.00" },
        { period: "2026-02-01", label: "01.02.", income: "0.00", expense: "5.00", invested: "4.00" },
        { period: "2026-02-02", label: "02.02.", income: "3.00", expense: "1.00", invested: "0.00" },
      ],
    });
    expect(points.map((p) => p.period)).toEqual(["2026-01", "2026-02"]);
    expect(points[0]).toMatchObject({ income: "10.00", expense: "2.00" });
    expect(points[1]).toMatchObject({ income: "3.00", expense: "6.00", invested: "4.00" });
  });
});
