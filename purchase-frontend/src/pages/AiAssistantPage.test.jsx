import React from "react";
import { render, screen } from "@testing-library/react";
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
    response: { status: 503, data: { error: "http://ollama:11434" } },
  });
  renderPage();
  expect(await screen.findByText("AI Unavailable")).toBeInTheDocument();
  expect(
    screen.getByText(/Normal procurement functions are unaffected/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/ollama/)).not.toBeInTheDocument();
});