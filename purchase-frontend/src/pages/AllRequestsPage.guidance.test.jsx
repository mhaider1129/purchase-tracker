import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
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
const mount = () =>
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AllRequestsPage />
    </MemoryRouter>,
  );

test("keeps progress visible in detailed and summary views without exposing restricted actions", async () => {
  const requests = [
    {
      id: 42,
      request_type: "IT",
      status: "Approved",
      justification: "Clinical workstation",
      assigned_user_name: "Ahmed",
      assigned_user_role: "SCM",
      created_at: "2026-10-01T10:00:00Z",
    },
  ];
  api.get.mockImplementation((url) =>
    Promise.resolve({
      data: url === "/requests" ? { data: requests, total: 1 } : [],
    }),
  );
  mount();
  const guidance = await screen.findByRole("region", {
    name: "Request progress and next action",
  });
  expect(within(guidance).getByText("Ahmed (SCM)")).toBeTruthy();
  expect(
    within(guidance).getByText(/Follow procurement progress/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Summary" }));
  expect(
    screen.getByRole("region", { name: "Request progress and next action" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Open Workspace" }).getAttribute("href"),
  ).toBe("/requests/42");
  expect(
    screen.queryByRole("button", { name: "Delete Permanently" }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Remind Approver" })).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
});

test("empty-state clear filters reloads the list with cleared API parameters", async () => {
  api.get.mockImplementation((url) =>
    Promise.resolve({
      data: url === "/requests" ? { data: [], total: 0 } : [],
    }),
  );
  mount();
  await screen.findByText(/No requests found for the selected filters/);
  fireEvent.change(
    screen.getByPlaceholderText("ID, requester, project, or keyword"),
    { target: { value: "missing" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  await waitFor(() =>
    expect(
      api.get.mock.calls.some(
        ([url, options]) =>
          url === "/requests" && options.params.search === "missing",
      ),
    ).toBe(true),
  );
  await screen.findByText(/No requests found for the selected filters/);
  api.get.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await waitFor(() =>
    expect(
      api.get.mock.calls.some(
        ([url, options]) => url === "/requests" && options.params.search === "",
      ),
    ).toBe(true),
  );
});
