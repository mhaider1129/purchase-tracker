import React from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import Panel from "./ProcurementCompletionPanel";
jest.mock("../utils/useUiTranslation", () => () => (value) => value);
test("distinguishes a paid, ordered request from unaccepted and unfulfilled demand", () => {
  render(
    <Panel
      completion={{
        procurement_complete: true,
        receipt_complete: false,
        fulfillment_complete: false,
        financial_complete: true,
        items: [],
      }}
    />,
  );
  expect(
    within(screen.getByText("Procurement committed").parentElement).getByText(
      "Verified",
    ),
  ).toBeInTheDocument();
  expect(
    within(
      screen.getByText("Department fulfillment verified").parentElement,
    ).getByText("Pending evidence"),
  ).toBeInTheDocument();
  expect(screen.getByText(/Financial completion/)).toHaveTextContent(
    "Verified",
  );
});
test("preserves exact quantities and identifies incomplete legacy evidence without offering a writer", () => {
  render(
    <Panel
      completion={{
        legacy_completion_without_fulfillment: true,
        evidence_gap: true,
        items: [
          {
            line_kind: "requested_item",
            line_id: "1",
            uom: "EA",
            quantity: "9007199254740993.0001",
            accepted_quantity: "0.0001",
            fulfilled_quantity: "0",
          },
        ],
      }}
    />,
  );
  expect(screen.getByText("9007199254740993.0001")).toBeInTheDocument();
  expect(screen.getByText("0.0001")).toBeInTheDocument();
  expect(screen.getByRole("note")).toHaveTextContent(
    "historical completion label",
  );
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
test("does not fabricate zero completion when evidence is unavailable", () => {
  render(<Panel />);
  expect(screen.getByRole("status")).toHaveTextContent("unavailable");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

test("requester confirmation uses exact remaining evidence and calls the existing handoff action", () => {
  const onAcknowledge = jest.fn();
  const line = {
    line_kind: "requested_item",
    line_id: "9",
    requested_item_id: "9",
    eligible: true,
    quantity: "9007199254740993.01",
    accepted_quantity: "9007199254740993.01",
    requester_acknowledged_quantity: "9007199254740993.00",
  };
  render(
    <Panel completion={{ items: [line] }} onAcknowledge={onAcknowledge} />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm physical receipt" }),
  );
  expect(onAcknowledge).toHaveBeenCalledWith(line);
});

test("quality acceptance of quarantined stock cannot offer requester acknowledgment", () => {
  const onAcknowledge = jest.fn();
  render(
    <Panel
      onAcknowledge={onAcknowledge}
      completion={{
        receipt_complete: false,
        fulfillment_complete: false,
        items: [
          {
            line_kind: "requested_item",
            line_id: "4",
            eligible: true,
            quantity: "10",
            technically_accepted_quantity: "10",
            pending_inspection_quantity: "0",
            accepted_pending_release_quantity: "10",
            accepted_quantity: "0",
            quarantined_quantity: "10",
            fulfilled_quantity: "0",
            warehouse_issued_quantity: "0",
          },
        ],
      }}
    />,
  );
  const headers = screen
    .getAllByRole("columnheader")
    .map((cell) => cell.textContent);
  const cells = screen.getAllByRole("cell");
  expect(cells[headers.indexOf("Quality accepted")]).toHaveTextContent("10");
  expect(cells[headers.indexOf("Available accepted")]).toHaveTextContent("0");
  expect(
    cells[headers.indexOf("Accepted awaiting availability")],
  ).toHaveTextContent("10");
  expect(
    screen.queryByRole("button", { name: "Confirm physical receipt" }),
  ).not.toBeInTheDocument();
});
