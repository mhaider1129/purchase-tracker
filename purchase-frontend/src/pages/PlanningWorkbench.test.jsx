import { summarizeForecast } from "./PlanningWorkbench";

describe("summarizeForecast", () => {
  it("calculates decision metrics for a forecast horizon", () => {
    const forecast = [
      { month: "2026-10", forecast_qty: 100 },
      { month: "2026-11", forecast_qty: 150 },
      { month: "2026-12", forecast_qty: 125 },
    ];

    expect(summarizeForecast(forecast)).toEqual({
      total: 375,
      average: 125,
      change: 25,
      peak: forecast[1],
    });
  });

  it("returns safe empty-state values", () => {
    expect(summarizeForecast()).toEqual({
      total: 0,
      average: 0,
      change: 0,
      peak: null,
    });
  });

  it("coerces invalid quantities without producing NaN", () => {
    expect(
      summarizeForecast([
        { month: "2026-10", forecast_qty: "20" },
        { month: "2026-11", forecast_qty: null },
      ]),
    ).toMatchObject({ total: 20, average: 10, change: -100 });
  });
});