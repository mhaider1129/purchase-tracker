import api from "./axios";
import aiService, { AI_CHAT_TIMEOUT_MS } from "./aiService";

jest.mock("./axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

describe("AI Intelligence API", () => {
  beforeEach(() => jest.clearAllMocks());

  test("lets the backend govern long-running analysis timeouts", async () => {
    api.post.mockResolvedValue({
      data: { message: "Analysis complete", conversationId: "conversation-1" },
    });

    await aiService.chat({
      message: "  Show procurement cases older than 30 days  ",
      conversationId: "conversation-1",
      context: { page: "ai-assistant" },
    });

    expect(AI_CHAT_TIMEOUT_MS).toBe(0);
    expect(api.post).toHaveBeenCalledWith(
      "/ai/chat",
      {
        message: "Show procurement cases older than 30 days",
        conversationId: "conversation-1",
        context: { page: "ai-assistant" },
      },
      {
        timeout: 0,
        __skipActionNotification: true,
      },
    );
  });
});