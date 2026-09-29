export const EVALUATION_DETAILS_ROUTE = "/evaluations/:id";

export const evaluationDetailsPath = (evaluationId) =>
  EVALUATION_DETAILS_ROUTE.replace(":id", encodeURIComponent(String(evaluationId)));