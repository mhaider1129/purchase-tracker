import React from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { hasPermission } from "../../utils/permissions";

const RequestAiButton = ({ onClick }) => {
  const { user } = useAuth();
  if (!hasPermission(user, "ai-intelligence.use")) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
    >
      <Sparkles size={16} aria-hidden="true" />
      Analyze with AI
    </button>
  );
};

export default RequestAiButton;