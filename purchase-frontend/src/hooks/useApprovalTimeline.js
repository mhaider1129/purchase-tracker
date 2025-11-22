import { useCallback, useState } from "react";
import axios from "../api/axios";

const useApprovalTimeline = () => {
  const [expandedApprovalsId, setExpandedApprovalsId] = useState(null);
  const [approvalsMap, setApprovalsMap] = useState({});
  const [loadingApprovalsId, setLoadingApprovalsId] = useState(null);

  const toggleApprovals = useCallback(
    async (requestId) => {
      if (expandedApprovalsId === requestId) {
        setExpandedApprovalsId(null);
        return;
      }

      if (!approvalsMap[requestId]) {
        try {
          setLoadingApprovalsId(requestId);
          const res = await axios.get(
            `/api/approvals/request/${requestId}/approvals`,
          );
          setApprovalsMap((prev) => ({ ...prev, [requestId]: res.data || [] }));
        } catch (err) {
          console.error(
            `❌ Failed to load approvals for request ${requestId}:`,
            err,
          );
          alert("Failed to load approvals");
        } finally {
          setLoadingApprovalsId(null);
        }
      }

      setExpandedApprovalsId(requestId);
    },
    [approvalsMap, expandedApprovalsId],
  );

  const resetApprovals = useCallback(() => {
    setExpandedApprovalsId(null);
    setApprovalsMap({});
    setLoadingApprovalsId(null);
  }, []);

  return {
    expandedApprovalsId,
    approvalsMap,
    loadingApprovalsId,
    toggleApprovals,
    resetApprovals,
  };
};

export default useApprovalTimeline;
