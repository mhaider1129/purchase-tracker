import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AiConversation from "./AiConversation";
import aiService from "../../api/aiService";

jest.mock("../../api/aiService", () => ({
  __esModule: true,
  default: { chat: jest.fn() },
  AI_MESSAGE_MAX_LENGTH: 4000,
  getAiErrorMessage: (error) =>
    error.response?.status === 403
      ? "You do not have permission to use AI Intelligence."
      : error.response?.status === 503
        ? "AI Intelligence is currently unavailable. Normal procurement functions are unaffected."
        : "Unable to reach AI Intelligence.",
}));

const response = (overrides = {}) => ({
  message: "Review the delayed request.",
  conversationId: "conversation-1",
  sources: [],
  warnings: [],
  coverage: {},
  toolsUsed: [],
  suggestedActions: [],
  ...overrides,
});
const renderChat = (props = {}) =>
  render(
    <MemoryRouter>
      <AiConversation
        starterPrompts={["What needs my attention?"]}
        {...props}
      />
    </MemoryRouter>,
  );

beforeEach(() => jest.clearAllMocks());

test("sends chat, reuses conversation ID, and resets it for a new conversation", async () => {
  aiService.chat.mockResolvedValue(response());
  renderChat();
  const input = screen.getByLabelText("Ask AI Intelligence");
  fireEvent.change(input, { target: { value: "First question" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await screen.findByText("Review the delayed request.");
  fireEvent.change(input, { target: { value: "Follow up" } });
  fireEvent.click(screen.getByLabelText("Send question"));
  await waitFor(() =>
    expect(aiService.chat).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: "Follow up",
        conversationId: "conversation-1",
      }),
    ),
  );
  fireEvent.click(screen.getByText("New Conversation"));
  fireEvent.change(input, { target: { value: "Fresh question" } });
  fireEvent.click(screen.getByLabelText("Send question"));
  await waitFor(() =>
    expect(aiService.chat).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: "Fresh question",
        conversationId: null,
      }),
    ),
  );
});

test("renders warnings, evidence, coverage, friendly tools, and AI text safely", async () => {
  aiService.chat.mockResolvedValue(
    response({
      message: '<img src=x onerror="alert(1)">Safe analysis',
      sources: [{ type: "request", id: "42", label: "PR-42" }],
      warnings: ["Some records were excluded."],
      coverage: { activity: { coverage: "PARTIAL" } },
      toolsUsed: ["get_request_summary"],
    }),
  );
  renderChat();
  fireEvent.click(screen.getByText("What needs my attention?"));
  expect(await screen.findByText(/Safe analysis/)).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "PR-42" })).toHaveAttribute(
    "href",
    "/requests/42",
  );
  expect(screen.getByText("Some records were excluded.")).toBeInTheDocument();
  expect(screen.getByLabelText("Evidence coverage")).toHaveTextContent("activity: PARTIAL");
  fireEvent.click(screen.getByText("Analysis sources"));
  expect(screen.getByText("Request Details")).toBeInTheDocument();
});

test.each([
  [403, "permission"],
  [503, "currently unavailable"],
])("handles %s safely", async (status, phrase) => {
  aiService.chat.mockRejectedValue({
    response: { status, data: { error: "internal secret" } },
  });
  renderChat();
  fireEvent.click(screen.getByText("What needs my attention?"));
  expect(await screen.findByRole("alert")).toHaveTextContent(phrase);
  expect(screen.queryByText("internal secret")).not.toBeInTheDocument();
});

test("sends contextual request identity on every message", async () => {
  aiService.chat.mockResolvedValue(response());
  const context = {
    page: "request-details",
    entityType: "request",
    entityId: "82",
  };
  renderChat({ context });
  fireEvent.click(screen.getByText("What needs my attention?"));
  await waitFor(() =>
    expect(aiService.chat).toHaveBeenCalledWith(
      expect.objectContaining({ context }),
    ),
  );
});