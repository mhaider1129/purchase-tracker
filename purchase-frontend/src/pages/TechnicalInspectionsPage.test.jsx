import {
  getChecklistProgress,
  getInspectionMetrics,
} from "./TechnicalInspectionsPage";

jest.mock("../api/technicalInspections", () => ({}));
jest.mock("../api/requests", () => ({}));

describe("technical inspection workspace summaries", () => {
  it("calculates checklist completion across all checks", () => {
    expect(
      getChecklistProgress({
        general_checklist: [{ condition: "good" }, { condition: "" }],
        category_checklist: [{ condition: "excellent" }, { condition: null }],
      }),
    ).toEqual({ completed: 2, total: 4, percentage: 50 });
  });

  it("counts decisions and treats a missing decision as pending", () => {
    expect(
      getInspectionMetrics([
        { acceptance_status: "passed" },
        { acceptance_status: "failed" },
        { acceptance_status: "pending" },
        {},
      ]),
    ).toEqual({ total: 4, pending: 2, passed: 1, failed: 1 });
  });
});