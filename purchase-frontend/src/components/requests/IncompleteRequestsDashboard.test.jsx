import React from "react";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "../../api/axios";
import Dashboard from "./IncompleteRequestsDashboard";
jest.mock("../../api/axios");
jest.mock("../../utils/useUiTranslation", () => () => (text) => text);
jest.mock(
  "./UrgentRequestBadge",
  () =>
    ({ urgent }) =>
      urgent ? <span>Urgent</span> : null,
);
const rows = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  request_type: i === 0 ? "Maintenance" : "Stock",
  department_name: i === 0 ? null : "Laboratory",
  section_name: "Blood bank",
  justification:
    i === 0
      ? '=sensitive, "quoted"\ntext'
      : "Clinical supplies needed for the department ".repeat(4),
  estimated_cost: 10,
  status: "Submitted",
  created_at: `2026-11-${String(i + 1).padStart(2, "0")}T18:00:00`,
  is_urgent: i === 0,
}));
function mount(scope = "all") {
  return render(
    <MemoryRouter>
      <Dashboard scope={scope} />
    </MemoryRouter>,
  );
}
const resultTable = () =>
  within(
    screen.getByRole("region", { name: "Incomplete request results" }),
  ).getByRole("table");
beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: rows });
});
test.each([
  ["all", "/requests/incomplete"],
  ["medical", "/requests/incomplete/medical"],
  ["operational", "/requests/incomplete/operational"],
])(
  "%s uses only its scoped API and paginates both ends",
  async (scope, endpoint) => {
    mount(scope);
    await screen.findByRole("region", { name: "Incomplete request results" });
    expect(axios.get).toHaveBeenCalledWith(endpoint);
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(within(resultTable()).getAllByRole("row")).toHaveLength(11);
    const top = screen.getByRole("navigation", { name: "Pagination (top)" });
    const bottom = screen.getByRole("navigation", {
      name: "Pagination (bottom)",
    });
    fireEvent.click(within(top).getByRole("button", { name: "Next" }));
    expect(within(bottom).getByText("Page 2 of 3")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Request Type"), {
      target: { value: "Maintenance" },
    });
    expect(within(resultTable()).getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("1 of 23 requests match")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Pagination (top)" }),
    ).not.toBeInTheDocument();
  },
);
test("date range includes the end day and handles invalid ranges, missing departments and reset", async () => {
  mount("medical");
  await screen.findByRole("region", { name: "Incomplete request results" });
  fireEvent.change(screen.getByLabelText("Department"), {
    target: { value: "Laboratory" },
  });
  expect(screen.getByText("22 of 23 requests match")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  fireEvent.change(screen.getByLabelText("From Date"), {
    target: { value: "2026-11-01" },
  });
  fireEvent.change(screen.getByLabelText("To Date"), {
    target: { value: "2026-11-01" },
  });
  expect(within(resultTable()).getByText("#1")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("From Date"), {
    target: { value: "2026-11-02" },
  });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "From Date must be on or before To Date",
  );
  expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  fireEvent.click(screen.getAllByRole("button", { name: "Reset filters" })[0]);
  expect(screen.getByText("23 of 23 requests match")).toBeInTheDocument();
});
test("urgent filter, token search, and compact/full justification views", async () => {
  mount();
  await screen.findByRole("region", { name: "Incomplete request results" });
  fireEvent.click(screen.getByRole("button", { name: "Summary" }));
  expect(
    within(resultTable()).getAllByText(/Clinical supplies needed.*…/),
  ).toHaveLength(10);
  fireEvent.click(screen.getByRole("button", { name: "Detailed" }));
  expect(screen.getByRole("button", { name: "Detailed" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.change(screen.getByLabelText("Urgency"), {
    target: { value: "urgent" },
  });
  expect(within(resultTable()).getByText("Urgent")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Search", { selector: "input" }), {
    target: { value: "missing match" },
  });
  expect(screen.getByText("No matching requests")).toBeInTheDocument();
});
test("CSV exports all filtered results rather than just the current page and protects spreadsheet formulas", async () => {
  let blob;
  URL.createObjectURL = jest.fn((value) => {
    blob = value;
    return "blob:test";
  });
  URL.revokeObjectURL = jest.fn();
  const click = jest
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  mount();
  await screen.findByRole("region", { name: "Incomplete request results" });
  fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
  const content = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(blob);
  });
  expect(content).toContain('"23","Stock"');
  expect(content).toContain('"1","Maintenance"');
  expect(content).toContain('"\'=sensitive, ""quoted""\ntext"');
  await waitFor(() =>
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test"),
  );
  click.mockRestore();
});
test("request errors can be retried without changing scope", async () => {
  axios.get.mockRejectedValueOnce({
    response: { data: { message: "Access denied" } },
  });
  mount("operational");
  expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("region", { name: "Incomplete request results" });
  expect(axios.get).toHaveBeenLastCalledWith(
    "/requests/incomplete/operational",
  );
});
