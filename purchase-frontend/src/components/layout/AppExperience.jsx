import React, { useEffect, useMemo, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useLocation } from "react-router-dom";

const ROUTE_LABELS = {
  "": "Request workspace",
  admin: "Administration",
  analytics: "Lifecycle analytics",
  approvals: "Approvals",
  contracts: "Contracts",
  custody: "Custody",
  dashboard: "Dashboard",
  equipment: "Equipment",
  login: "Sign in",
  management: "Management",
  planning: "Planning",
  register: "User registration",
  requests: "Requests",
  suppliers: "Suppliers",
  tasks: "My tasks",
};

const humanizeSegment = (segment = "") =>
  segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const AppExperience = () => {
  const { pathname } = useLocation();
  const [showBackToTop, setShowBackToTop] = useState(false);

  const pageLabel = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const leaf = [...segments]
      .reverse()
      .find((segment) => !/^\d+$/.test(segment));
    return (
      ROUTE_LABELS[pathname.slice(1)] ||
      ROUTE_LABELS[segments[0] || ""] ||
      humanizeSegment(leaf) ||
      "Purchase Tracker"
    );
  }, [pathname]);

  useEffect(() => {
    document.title = `${pageLabel} · Purchase Tracker`;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pageLabel, pathname]);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 560);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {pageLabel} page loaded
      </p>
      <button
        type="button"
        className={`back-to-top ${showBackToTop ? "back-to-top--visible" : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        title="Back to top"
        tabIndex={showBackToTop ? 0 : -1}
      >
        <ArrowUp size={19} aria-hidden="true" />
      </button>
    </>
  );
};

export default AppExperience;