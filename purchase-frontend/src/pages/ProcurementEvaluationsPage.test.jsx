import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import procurementEvaluationsApi from "../api/procurementEvaluations";
import ProcurementEvaluationsPage from "./ProcurementEvaluationsPage";

jest.mock("../api/procurementEvaluations", () => ({
  __esModule: true,
  default: { list: jest.fn(), create: jest.fn(), calculate: jest.fn() },
}));

const cases = [
  { id: 1, title: "Analyzer replacement", category: "Laboratory", evaluation_type: "Laboratory Device", status: "In Review", best_score: 84.5, best_tco: 120000, currency: "USD" },
  { id: 2, title: "Network renewal", category: "Technology", evaluation_type: "IT System", status: "Finalized", best_score: 91, best_tco: 64000, currency: "USD" },
];

const renderPage = () => render(<MemoryRouter><ProcurementEvaluationsPage /></MemoryRouter>);

beforeEach(() => {
  jest.clearAllMocks();
  procurementEvaluationsApi.list.mockResolvedValue({ data: cases });
});

test("summarizes and filters the evaluation portfolio", async () => {
  renderPage();
  expect(await screen.findByText("Analyzer replacement")).toBeInTheDocument();
  expect(screen.getByText("Network renewal")).toBeInTheDocument();
  expect(screen.getByText("87.8")).toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText("Search title, category, department…"), { target: { value: "network" } });
  expect(screen.queryByText("Analyzer replacement")).not.toBeInTheDocument();
  expect(screen.getByText("Network renewal")).toBeInTheDocument();
  expect(screen.getByText("1 of 2 evaluations")).toBeInTheDocument();
});

test("opens the guided evaluation form", async () => {
  renderPage();
  await screen.findByText("Analyzer replacement");
  fireEvent.click(screen.getByRole("button", { name: "New evaluation" }));
  expect(screen.getByRole("dialog", { name: "Create an evaluation" })).toBeInTheDocument();
  expect(screen.getByLabelText("Evaluation title")).toHaveFocus();
});

test("recalculates an evaluation and refreshes the portfolio", async () => {
  procurementEvaluationsApi.calculate.mockResolvedValue({ data: {} });
  renderPage();
  await screen.findByText("Analyzer replacement");
  fireEvent.click(screen.getAllByRole("button", { name: "Recalculate" })[0]);
  await waitFor(() => expect(procurementEvaluationsApi.calculate).toHaveBeenCalledWith(1));
  await waitFor(() => expect(procurementEvaluationsApi.list).toHaveBeenCalledTimes(2));
});