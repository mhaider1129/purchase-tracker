import React from "react";
import { render, screen, within } from "@testing-library/react";
import WorkspaceSectionNav from "./WorkspaceSectionNav";
import WorkspaceTableScroll from "./WorkspaceTableScroll";
import RequestActionContext from "./RequestActionContext";
import ApprovalDecisionSummary from "./ApprovalDecisionSummary";
import RequestAgeBadge, { getRequestAgeDays } from "./RequestAgeBadge";

import i18n from "../../i18n";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import en from "../../locales/en.json";
import ar from "../../locales/ar.json";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

test("section shortcuts have descriptive names and link to the supplied targets", () => {
  render(
    <WorkspaceSectionNav
      sections={[
        { id: "filters", label: "filters" },
        { id: "queue", label: "approvalQueue" },
      ]}
    />,
  );
  const nav = within(
    screen.getByRole("navigation", { name: "Jump to section" }),
  );
  expect(nav.getByRole("link", { name: "Search & filters" })).toHaveAttribute(
    "href",
    "#filters",
  );
  expect(nav.getByRole("link", { name: "Approval queue" })).toHaveAttribute(
    "href",
    "#queue",
  );
});

test("table scroll areas are keyboard focusable and retain table semantics", () => {
  render(
    <WorkspaceTableScroll>
      <table>
        <caption>Inventory</caption>
        <tbody>
          <tr>
            <td>Gloves</td>
          </tr>
        </tbody>
      </table>
    </WorkspaceTableScroll>,
  );
  const region = screen.getByRole("region", { name: "Scrollable data table" });
  expect(region).toHaveAttribute("tabindex", "0");
  expect(
    within(region).getByRole("table", { name: "Inventory" }),
  ).toBeInTheDocument();
  expect(
    within(region).getByText("Scroll horizontally to view all columns."),
  ).toBeInTheDocument();
});

test("request context uses server-provided values and handles missing data without inventing an action", () => {
  const { rerender } = render(
    <RequestActionContext
      request={{
        next_required_action: "Review supplier quote",
        assigned_to_name: "Ahmed",
        current_bottleneck: "Awaiting quote",
      }}
    />,
  );
  const context = within(
    screen.getByRole("region", { name: "Current request context" }),
  );
  expect(context.getByText("Review supplier quote")).toBeInTheDocument();
  expect(context.getByText("Ahmed")).toBeInTheDocument();
  expect(context.getByText("Awaiting quote")).toBeInTheDocument();
  rerender(<RequestActionContext request={{}} />);
  expect(context.getAllByText("Not provided")).toHaveLength(3);
});

test("decision totals reflect default approval, changed decisions and removed requests", () => {
  const { rerender } = render(
    <ApprovalDecisionSummary
      requestIds={[1, 2, 3]}
      decisions={{ 2: "Rejected", 3: "Approved" }}
    />,
  );
  expect(screen.getByText(/Requests in summary/)).toHaveTextContent(
    "Requests in summary: 3",
  );
  expect(screen.getByText(/To approve/)).toHaveTextContent("To approve: 2");
  expect(screen.getByText(/To reject/)).toHaveTextContent("To reject: 1");
  rerender(
    <ApprovalDecisionSummary
      requestIds={[1, 3]}
      decisions={{ 2: "Rejected", 3: "Rejected" }}
    />,
  );
  expect(screen.getByText(/To approve/)).toHaveTextContent("To approve: 1");
  expect(screen.getByText(/To reject/)).toHaveTextContent("To reject: 1");
});

test("age calculation handles elapsed days, future dates and missing or invalid timestamps", () => {
  const now = Date.parse("2026-10-06T12:00:00Z");
  expect(getRequestAgeDays("2026-10-04T13:00:00Z", now)).toBe(1);
  expect(getRequestAgeDays("2026-10-07T12:00:00Z", now)).toBe(0);
  expect(getRequestAgeDays("", now)).toBeNull();
  expect(getRequestAgeDays("invalid", now)).toBeNull();
});

test("age badges omit unknown dates and use a translated elapsed-day label", () => {
  jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-06T12:00:00Z"));
  const { rerender } = render(
    <RequestAgeBadge createdAt="2026-10-05T12:00:00Z" />,
  );
  expect(screen.getByText("Submitted 1 day ago")).toBeInTheDocument();
  rerender(<RequestAgeBadge createdAt="invalid" />);
  expect(screen.queryByText(/Submitted/)).not.toBeInTheDocument();
  jest.restoreAllMocks();
});

test.each(["en", "ar"])(
  "real app resources resolve every workspace label in %s",
  async (language) => {
    await i18n.changeLanguage(language);
    const labels =
      language === "ar" ? ar.operationalWorkspace : en.operationalWorkspace;
    Object.entries(labels)
      .filter(([key]) => !key.startsWith("requestAge_"))
      .forEach(([key, value]) => {
        expect(i18n.t(`operationalWorkspace.${key}`)).toBe(value);
      });
    for (const count of [0, 1, 2, 3, 11, 100]) {
      expect(
        i18n.t("operationalWorkspace.requestAge", { count }),
      ).not.toContain("operationalWorkspace.");
    }
  },
);

test.each(["en", "ar"])(
  "incomplete provider resources still show readable workspace controls in %s",
  async (language) => {
    const incomplete = createInstance();
    await incomplete.init({
      lng: language,
      fallbackLng: false,
      resources: { [language]: { translation: {} } },
      interpolation: { escapeValue: false },
    });
    const labels =
      language === "ar" ? ar.operationalWorkspace : en.operationalWorkspace;
    jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-06T12:00:00Z"));
    const { container } = render(
      <I18nextProvider i18n={incomplete}>
        <WorkspaceSectionNav
          sections={[
            { id: "filters", label: "filters" },
            { id: "results", label: "requestResults" },
            { id: "queue", label: "approvalQueue" },
            { id: "transfers", label: "transfers" },
            { id: "allocations", label: "allocations" },
            { id: "inventory", label: "inventory" },
            { id: "report", label: "report" },
          ]}
        />
        <RequestActionContext request={{}} />
        <WorkspaceTableScroll>
          <table>
            <tbody>
              <tr>
                <td>Item</td>
              </tr>
            </tbody>
          </table>
        </WorkspaceTableScroll>
        <ApprovalDecisionSummary requestIds={[1]} decisions={{}} />
        <RequestAgeBadge createdAt="2026-10-04T12:00:00Z" />
      </I18nextProvider>,
    );
    expect(
      screen.getByRole("navigation", { name: labels.jumpTo }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: labels.filters })).toHaveAttribute(
      "href",
      "#filters",
    );
    expect(screen.getAllByText(labels.notProvided)).toHaveLength(3);
    expect(
      screen.getByRole("region", { name: labels.tableLabel }),
    ).toBeInTheDocument();
    expect(container.textContent).not.toContain("operationalWorkspace.");
    expect(container.innerHTML).not.toContain("operationalWorkspace.");
    jest.restoreAllMocks();
  },
);
