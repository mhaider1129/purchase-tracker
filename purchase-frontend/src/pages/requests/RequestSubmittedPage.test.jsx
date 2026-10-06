import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import i18n from "../../i18n";
import RequestSubmittedPage from "./RequestSubmittedPage";

function Destination() {
  return <p>Destination: {useLocation().pathname}</p>;
}
function renderPage(state) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: "/request-submitted", state }]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/request-submitted" element={<RequestSubmittedPage />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(async () => {
  await i18n.changeLanguage("en");
});

const state = {
  requestType: "Non-Stock",
  summary: {
    requestId: 81,
    estimatedCost: 0,
    attachmentsUploaded: 0,
    nextApproval: {
      approverName: "General warehouse",
      approverRole: "WarehouseManager",
      level: 0,
    },
    duplicateDetected: true,
    message: "Request created successfully with approval routing",
  },
  items: [
    { id: 1, name: "Gloves", quantity: 500, purchasedQuantity: 0 },
    { id: 2, name: "Masks", quantity: 10, purchasedQuantity: 5 },
    { id: 3, name: "Gauze", quantity: 20, purchasedQuantity: 20 },
  ],
};
test("confirmation preserves zero values, routing details, duplicate warning and item purchase states", () => {
  renderPage(state);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Non-Stock Request Submitted Successfully!",
  );
  expect(
    screen.getByText("General warehouse (WarehouseManager)"),
  ).toBeInTheDocument();
  expect(screen.getByText("Level 0")).toBeInTheDocument();
  expect(screen.getByRole("note")).toHaveTextContent(
    "Procurement has been notified",
  );
  expect(
    screen.getByText("Request created successfully with approval routing"),
  ).toBeInTheDocument();
  expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(3);
  const rows = within(screen.getByRole("table")).getAllByRole("row");
  expect(rows[1]).toHaveTextContent("Not purchased");
  expect(rows[2]).toHaveTextContent("Partially purchased");
  expect(rows[3]).toHaveTextContent("Purchased");
  expect(screen.getByText("3 line items")).toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Item status overview" }),
  ).toHaveAttribute("tabindex", "0");
});

test.each([
  ["View My Open Requests", "/open-requests"],
  ["Submit Another Request", "/request-type"],
  ["Back to Home", "/"],
])("%s keeps the existing destination", (label, destination) => {
  renderPage(state);
  fireEvent.click(screen.getByRole("button", { name: label }));
  expect(screen.getByText(`Destination: ${destination}`)).toBeInTheDocument();
});

test("direct visits handle unavailable summary values and empty items", () => {
  renderPage(undefined);
  expect(
    screen.getByText("No items were included with this request."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByRole("note")).not.toBeInTheDocument();
  expect(screen.getAllByText("Not available")).toHaveLength(2);
});

test("Arabic confirmation uses real translations including new headings and plurals", async () => {
  await i18n.changeLanguage("ar");
  const { container } = renderPage(state);
  expect(screen.getByText("تأكيد تقديم الطلب")).toBeInTheDocument();
  expect(screen.getByText("طلب مكرر محتمل")).toBeInTheDocument();
  expect(screen.getByText("3 بنود")).toBeInTheDocument();
  expect(container.textContent).not.toContain("requestSubmitted.");
});
