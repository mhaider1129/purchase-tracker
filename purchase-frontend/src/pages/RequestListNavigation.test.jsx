import React from "react";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "../i18n";
import api from "../api/axios";
import AllRequestsPage from "./AllRequestsPage";
jest.mock("../api/axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
}));
jest.mock("../hooks/useCurrentUser", () => () => ({
  user: { role: "Requester", permissions: [] },
}));
beforeEach(async () => {
  jest.clearAllMocks();
  localStorage.clear();
  await i18n.changeLanguage("en");
});
test("All Requests keeps top/bottom pagination synchronized and urgency across both views", async () => {
  const requests = [
    {
      id: 42,
      request_type: "IT",
      status: "Pending",
      is_urgent: true,
      justification: "Clinical workstations",
      department_name: "IT",
    },
    {
      id: 43,
      request_type: "Stock",
      status: "Pending",
      is_urgent: false,
      justification: "Routine supplies",
    },
  ];
  api.get.mockImplementation((url, options) =>
    Promise.resolve({
      data:
        url === "/requests"
          ? {
              data:
                options.params.page === 2
                  ? [
                      {
                        ...requests[0],
                        id: 52,
                        justification: "Second page workstation",
                      },
                    ]
                  : requests,
              total: 23,
            }
          : [],
    }),
  );
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AllRequestsPage />
    </MemoryRouter>,
  );
  const top = within(
    await screen.findByRole("navigation", { name: "Pagination (top)" }),
  );
  const bottom = within(screen.getByRole("navigation", { name: "Pagination" }));
  const urgentCard = screen
    .getByText("Clinical workstations")
    // The card surface owns urgency and density styling.
    // eslint-disable-next-line testing-library/no-node-access
    .closest(".request-list-card");
  expect(urgentCard).toHaveClass(
    "request-card--urgent",
    "request-list-card--detailed",
  );
  expect(
    // eslint-disable-next-line testing-library/no-node-access
    screen.getByText("Routine supplies").closest(".request-list-card"),
  ).not.toHaveClass("request-card--urgent");
  fireEvent.click(screen.getByRole("button", { name: "Summary" }));
  expect(urgentCard).toHaveClass(
    "request-card--urgent",
    "request-list-card--summary",
  );
  fireEvent.click(top.getByRole("button", { name: "2" }));
  await screen.findByText("Second page workstation");
  expect(bottom.getByRole("button", { name: "2" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(top.getByRole("combobox")).toHaveValue("2");
  await waitFor(() =>
    expect(
      api.get.mock.calls.some(
        ([url, options]) => url === "/requests" && options.params.page === 2,
      ),
    ).toBe(true),
  );
  expect(api.post).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
});
