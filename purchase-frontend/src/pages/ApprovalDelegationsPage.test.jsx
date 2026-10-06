import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ApprovalDelegationsPage from "./ApprovalDelegationsPage";
import api from "../api/axios";
import { useAuth } from "../hooks/useAuth";
jest.mock("../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../hooks/useAuth", () => ({ useAuth: jest.fn() }));
const position = {
  id: 501,
  organization_unit_name: "CEO Executive Office",
  position_name: "Chief Executive Officer",
  position_type: "EXECUTIVE_HEAD",
  user_id: null,
  holder_name: null,
};
const row = {
  id: 801,
  organization_position_id: 501,
  authority_unit_name: "CEO Executive Office",
  position_name: position.position_name,
  position_type: position.position_type,
  structural_holder_name: null,
  delegate_user_name: "COO user",
  effective_from: "2026-10-10T00:00:00Z",
  effective_to: "2026-10-20T00:00:00Z",
  scope: "PURCHASE_REQUEST_APPROVAL",
  reason: "Purchase authority",
  status: "ACTIVE",
};
beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({
    user: {
      permissions: ["approval-delegation.view", "approval-delegation.manage"],
    },
  });
  api.get.mockImplementation(async (path) => ({
    data: path.endsWith("/options")
      ? { positions: [position], users: [{ id: 702, name: "COO user" }] }
      : [],
  }));
  api.post.mockResolvedValue({ data: row });
});
async function fill(kind = "POSITION") {
  await screen.findByText("Create delegation", { selector: "h2" });
  fireEvent.change(screen.getByLabelText("Authority type"), {
    target: { value: kind },
  });
  fireEvent.change(
    screen.getByLabelText(
      kind === "POSITION" ? "Authority" : "Delegator user",
      { exact: true },
    ),
    { target: { value: kind === "POSITION" ? "501" : "702" } },
  );
  fireEvent.change(screen.getByLabelText("Delegated to"), {
    target: { value: "702" },
  });
  fireEvent.change(screen.getByLabelText("Effective from"), {
    target: { value: "2026-10-10T00:00" },
  });
  fireEvent.change(screen.getByLabelText("Effective to"), {
    target: { value: "2026-10-20T00:00" },
  });
  fireEvent.change(screen.getByLabelText("Reason", { exact: true }), {
    target: { value: "Purchase authority" },
  });
}
test("administrator selects an unstaffed position and submits without a delegator or institute", async () => {
  render(<ApprovalDelegationsPage />);
  await fill();
  expect(
    screen.getByText("Current system holder: No system user assigned"),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Delegator user")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Create delegation" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][1]).toEqual({
    organizationPositionId: "501",
    delegateUserId: "702",
    effectiveFrom: new Date("2026-10-10T00:00").toISOString(),
    effectiveTo: new Date("2026-10-20T00:00").toISOString(),
    scope: "PURCHASE_REQUEST_APPROVAL",
    reason: "Purchase authority",
  });
  await screen.findByText("Delegation created.");
});
test("view-only page distinguishes authority, holder, delegate, period, scope and reason", async () => {
  api.get.mockResolvedValue({ data: [row] });
  useAuth.mockReturnValue({
    user: { permissions: ["approval-delegation.view"] },
  });
  render(<ApprovalDelegationsPage />);
  await screen.findByText(
    /Authority: CEO Executive Office.*Chief Executive Officer \/ EXECUTIVE_HEAD/,
  );
  expect(
    screen.getByText("Current system holder: No system user assigned"),
  ).toBeInTheDocument();
  expect(screen.getByText("Delegated to: COO user")).toBeInTheDocument();
  expect(screen.getByText(/Effective period:/)).toBeInTheDocument();
  expect(
    screen.getByText("Scope: PURCHASE_REQUEST_APPROVAL"),
  ).toBeInTheDocument();
  expect(screen.getByText("Reason: Purchase authority")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Revoke" }),
  ).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
});
test("user-based delegation submits its delegator and displays backend errors", async () => {
  render(<ApprovalDelegationsPage />);
  await fill("USER");
  api.post.mockRejectedValue({
    response: { data: { error: "Self-delegation is not permitted" } },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create delegation" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Self-delegation is not permitted",
  );
  expect(api.post.mock.calls[0][1]).toMatchObject({ delegatorUserId: "702" });
  expect(api.post.mock.calls[0][1]).not.toHaveProperty(
    "organizationPositionId",
  );
});
test("revocation uses the governed endpoint with a reason", async () => {
  api.get.mockImplementation(async (path) => ({
    data: path.endsWith("/options")
      ? { positions: [position], users: [] }
      : [row],
  }));
  render(<ApprovalDelegationsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
  fireEvent.change(screen.getByLabelText("Revocation reason"), {
    target: { value: "Authority returned" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm revocation" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/approval-authority-delegations/801/revoke",
      { reason: "Authority returned" },
    ),
  );
  await screen.findByText("Delegation revoked.");
});
test("missing view permission performs no reads or mutations", () => {
  useAuth.mockReturnValue({ user: { permissions: [] } });
  render(<ApprovalDelegationsPage />);
  expect(screen.getByRole("alert")).toHaveTextContent("Permission required");
  expect(api.get).not.toHaveBeenCalled();
});
test("load failures are visible and can be retried", async () => {
  api.get.mockRejectedValue(new Error("Could not load delegations"));
  render(<ApprovalDelegationsPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not load delegations",
  );
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(4));
  await screen.findByRole("alert");
});

test("search and status filters distinguish scheduled, expired and revoked delegations", async () => {
  const future = {
    ...row,
    id: 802,
    delegate_user_name: "Future approver",
    effective_from: "2999-01-01T00:00:00Z",
    effective_to: "2999-02-01T00:00:00Z",
  };
  const expired = {
    ...row,
    id: 803,
    delegate_user_name: "Past approver",
    effective_from: "2000-01-01T00:00:00Z",
    effective_to: "2000-02-01T00:00:00Z",
  };
  const revoked = {
    ...future,
    id: 804,
    status: "REVOKED",
    delegate_user_name: "Revoked approver",
  };
  api.get.mockResolvedValue({ data: [future, expired, revoked] });
  useAuth.mockReturnValue({
    user: { permissions: ["approval-delegation.view"] },
  });
  render(<ApprovalDelegationsPage />);
  await screen.findByText("Delegated to: Future approver");
  fireEvent.change(screen.getByLabelText("Filter by status"), {
    target: { value: "SCHEDULED" },
  });
  expect(
    screen.queryByText("Delegated to: Past approver"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("Delegated to: Revoked approver"),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Search delegations"), {
    target: { value: "unknown authority" },
  });
  expect(screen.getByText("No matching delegations")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Search delegations"), {
    target: { value: "" },
  });
  fireEvent.change(screen.getByLabelText("Filter by status"), {
    target: { value: "EXPIRED" },
  });
  expect(screen.getByText("Delegated to: Past approver")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter by status"), {
    target: { value: "REVOKED" },
  });
  expect(
    screen.getByText("Delegated to: Revoked approver"),
  ).toBeInTheDocument();
});
