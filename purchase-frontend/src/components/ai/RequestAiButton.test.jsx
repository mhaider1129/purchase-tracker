import React from "react";
import { render, screen } from "@testing-library/react";
import RequestAiButton from "./RequestAiButton";
import { useAuth } from "../../hooks/useAuth";
jest.mock("../../hooks/useAuth", () => ({ useAuth: jest.fn() }));

test("is hidden without AI permission", () => {
  useAuth.mockReturnValue({ user: { permissions: [] } });
  render(<RequestAiButton />);
  expect(screen.queryByText("Analyze with AI")).not.toBeInTheDocument();
});
test("is visible with AI permission", () => {
  useAuth.mockReturnValue({ user: { permissions: ["ai-intelligence.use"] } });
  render(<RequestAiButton />);
  expect(screen.getByText("Analyze with AI")).toBeInTheDocument();
});