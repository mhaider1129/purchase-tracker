import { EVALUATION_DETAILS_ROUTE, evaluationDetailsPath } from "./routes";

describe("application routes", () => {
  test("builds contract evaluation links from the registered route", () => {
    expect(EVALUATION_DETAILS_ROUTE).toBe("/evaluations/:id");
    expect(evaluationDetailsPath(42)).toBe("/evaluations/42");
  });
});