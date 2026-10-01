import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AiAssistantPage from "./AiAssistantPage";
import aiService from "../api/aiService";

jest.mock("../api/aiService", () => ({
  __esModule: true,
  default: { health: jest.fn(), chat: jest.fn() },
  AI_MESSAGE_MAX_LENGTH: 4000,
  getAiErrorMessage: jest.fn(),
}));
const renderPage = () =>
  render(
    <MemoryRouter>
      <AiAssistantPage />
    </MemoryRouter>,
  );
beforeEach(() => jest.clearAllMocks());

test("renders assistant page and available health", async () => {
  aiService.health.mockResolvedValue({ data: { status: "available" } });
  renderPage();
  expect(
    screen.getByRole("heading", { name: "AI Assistant" }),
  ).toBeInTheDocument();
  expect(await screen.findByText("AI Available")).toBeInTheDocument();
});

test("renders unavailable health without exposing backend details", async () => {
  aiService.health.mockRejectedValue({
    response: {
      status: 503,
      data: {
        error: "http://ollama:11434",
        reason: "AI_SERVICE_UNAVAILABLE",
      },
    },
  });
  renderPage();
  expect(await screen.findByText("AI Unavailable")).toBeInTheDocument();
  expect(
    screen.getByText(/Normal procurement functions are unaffected/),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Ask AI Intelligence")).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "verify that it is running and reachable from the backend",
  );
  expect(
    screen.getByRole("button", { name: /Retry connection/ }),
  ).toBeEnabled();
  expect(screen.queryByText(/ollama/)).not.toBeInTheDocument();
});

test("can retry an unavailable AI connection", async () => {
  const user = userEvent.setup();
  aiService.health
    .mockRejectedValueOnce({ response: { status: 503 } })
    .mockResolvedValueOnce({ data: { status: "available" } });
  renderPage();

  await user.click(
    await screen.findByRole("button", { name: /Retry connection/ }),
  );

  expect(await screen.findByText("AI Available")).toBeInTheDocument();
  expect(screen.getByLabelText("Ask AI Intelligence")).toBeEnabled();
});