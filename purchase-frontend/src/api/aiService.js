import api from "./axios";

export const AI_MESSAGE_MAX_LENGTH = 4000;

const asArray = (value) => (Array.isArray(value) ? value : []);
const cleanText = (value) =>
  typeof value === "string" ? value.trim() : value == null ? "" : String(value);

export const normalizeAiResponse = (payload = {}) => ({
  message: cleanText(payload.message) || "No response was generated.",
  conversationId: cleanText(payload.conversationId) || null,
  sources: asArray(payload.sources)
    .map((source) => ({
      type: cleanText(source?.type),
      id: source?.id == null ? null : String(source.id),
      label: cleanText(source?.label) || "System record",
    }))
    .filter((source) => source.label),
  warnings: asArray(payload.warnings).map(cleanText).filter(Boolean),
  coverage:
    payload.coverage && typeof payload.coverage === "object"
      ? payload.coverage
      : cleanText(payload.coverage),
  toolsUsed: asArray(payload.toolsUsed).map(cleanText).filter(Boolean),
  suggestedActions: asArray(payload.suggestedActions)
    .map((action) =>
      typeof action === "string"
        ? { label: cleanText(action) }
        : {
            label: cleanText(
              action?.label || action?.title || action?.description,
            ),
          },
    )
    .filter((action) => action.label),
});

export const getAiErrorMessage = (error) => {
  const status = error?.response?.status;
  if (status === 403)
    return "You do not have permission to use AI Intelligence.";
  if (status === 429)
    return "AI requests are temporarily limited. Please try again shortly.";
  if (status === 503)
    return "AI Intelligence is currently unavailable. Normal procurement functions are unaffected.";
  if (status === 401)
    return "Your session could not be verified. Please sign in again.";
  if (status >= 500)
    return "AI Intelligence could not complete the analysis. Please try again later.";
  if (error?.code === "ECONNABORTED")
    return "AI Intelligence took too long to respond. Please try again.";
  if (!error?.response) return "Unable to reach AI Intelligence.";
  return "AI Intelligence could not complete the request.";
};

const aiService = {
  health: () => api.get("/ai/health", { __skipActionNotification: true }),
  chat: async ({ message, conversationId, context }) => {
    const body = { message: message.trim() };
    if (conversationId) body.conversationId = conversationId;
    if (context) body.context = context;
    const response = await api.post("/ai/chat", body, {
      timeout: 60000,
      __skipActionNotification: true,
    });
    return normalizeAiResponse(response.data);
  },
};

export default aiService;