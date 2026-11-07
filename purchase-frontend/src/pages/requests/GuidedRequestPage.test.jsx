import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GuidedRequestPage, { GuidedRequestForm } from "./GuidedRequestPage";
import {
  getGuidedOptions,
  previewGuidedRequest,
  submitGuidedRequest,
} from "../../api/guidedRequests";
import en from "../../locales/en.json";
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}));
jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ token: "fixture-user" }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) =>
      key
        .split(".")
        .reduce(
          (value, part) => value?.[part],
          require("../../locales/en.json"),
        ) || key,
    i18n: { dir: () => "ltr" },
  }),
}));
jest.mock("../../api/guidedRequests", () => ({
  getGuidedOptions: jest.fn(),
  previewGuidedRequest: jest.fn(),
  submitGuidedRequest: jest.fn(),
  searchGuidedItems: jest.fn(),
}));
jest.mock("./RequestTypeSelector", () => () => <p>Legacy forms</p>);
jest.mock(
  "../../components/requests/GenericItemSelector",
  () =>
    ({ onChange }) => (
      <button
        type="button"
        onClick={() =>
          onChange({
            item_name: "Catalog item",
            generic_item_id: 801,
            request_mode: "generic_item",
            catalog_status: "catalogued",
            canonical_description_snapshot: "Server snapshot",
            unit_of_measure: "Piece",
          })
        }
      >
        Select catalog fixture
      </button>
    ),
);
const families = [
  ["general", []],
  ["warehouse", []],
  ["medication", ["dosage"]],
  ["medical_supplies", []],
  ["specialty", ["specialty", "procedure"]],
  ["it", ["location", "equipment_model"]],
  ["maintenance", ["location", "work_order_reference"]],
  ["recurring", ["period", "frequency"]],
  ["laboratory", ["analyzer_model", "period"]],
  ["spare_parts", ["equipment_model", "part_number"]],
  ["device", ["intended_use", "location"]],
  ["procedure", ["procedure", "procedure_date"]],
  ["safety", ["function"]],
  [
    "nuclear",
    [
      "isotope",
      "activity",
      "activity_unit",
      "calibration_at",
      "authorization_reference",
    ],
  ],
].map(([id, fields]) => ({ id, fields, enabled: true }));
const options = {
  requester: {
    id: 801,
    name: "Requester",
    institute_id: 801,
    institute_name: "Hospital",
    department_id: 801,
    department_name: "Clinical",
  },
  families,
  categories: [{ id: 801, name: "Clinical items" }],
  purposes: [{ code: "ROUTINE", label: "Routine" }],
  attachments: { max_files: 2, max_bytes: 100 },
  sap_inventory: { available: false },
};
beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  previewGuidedRequest.mockResolvedValue({
    request_type: "Non-Stock",
    approvals: [{ role: "SCM", level: 1 }],
    estimated: true,
  });
  submitGuidedRequest.mockResolvedValue({
    request_id: 1396,
    request_type: "Non-Stock",
  });
});
afterEach(() => {
  delete process.env.REACT_APP_GUIDED_REQUESTS_ENABLED;
});
test.each(families)(
  "$id exposes only appropriate specialized fields",
  (family) => {
    render(<GuidedRequestForm options={options} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: en.guidedRequest.families[family.id],
      }),
    );
    for (const field of family.fields)
      expect(
        screen.getByLabelText(en.guidedRequest.fields[field]),
      ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/patient name|MRN/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(en.guidedRequest.sapUnavailable),
    ).toBeInTheDocument();
  },
);
test("server-disabled family remains unselectable", () => {
  render(
    <GuidedRequestForm
      options={{ ...options, families: [{ ...families[2], enabled: false }] }}
    />,
  );
  expect(
    screen.getByRole("button", {
      name: new RegExp(en.guidedRequest.families.medication),
    }),
  ).toBeDisabled();
});
const fillGeneral = () => {
  fireEvent.click(
    screen.getByRole("button", { name: en.guidedRequest.families.general }),
  );
  fireEvent.change(screen.getByLabelText(en.guidedRequest.category), {
    target: { value: "801" },
  });
  fireEvent.change(screen.getByLabelText(en.guidedRequest.purpose), {
    target: { value: "ROUTINE" },
  });
  fireEvent.change(screen.getByLabelText(en.guidedRequest.requiredBy), {
    target: { value: "2099-01-01" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Select catalog fixture" }),
  );
  fireEvent.change(screen.getByLabelText(en.guidedRequest.justification), {
    target: { value: "Care requirement" },
  });
  fireEvent.change(screen.getByLabelText(en.guidedRequest.impact), {
    target: { value: "Care disruption" },
  });
};
test("review uses API policy then submits canonical payload and navigates with request ID", async () => {
  render(<GuidedRequestForm options={options} />);
  fillGeneral();
  fireEvent.click(
    screen.getByRole("button", { name: en.guidedRequest.review }),
  );
  await screen.findByText("SCM · 1");
  const payload = previewGuidedRequest.mock.calls[0][0];
  expect(payload.items[0].generic_item_id).toBe(801);
  expect(payload.items[0].catalog_status).toBeUndefined();
  expect(payload.requester_id).toBeUndefined();
  expect(payload.institute_id).toBeUndefined();
  fireEvent.click(
    screen.getByRole("button", { name: en.guidedRequest.submit }),
  );
  await waitFor(() =>
    expect(mockNavigate).toHaveBeenCalledWith(
      "/request-submitted",
      expect.objectContaining({
        state: expect.objectContaining({
          summary: expect.objectContaining({ requestId: 1396 }),
        }),
      }),
    ),
  );
});
test("draft survives remount for same actor; a different institute does not restore it", () => {
  const view = render(<GuidedRequestForm options={options} />);
  fillGeneral();
  fireEvent.click(
    screen.getByRole("button", { name: en.guidedRequest.saveDraft }),
  );
  view.unmount();
  const { unmount } = render(<GuidedRequestForm options={options} />);
  fireEvent.click(
    screen.getByRole("button", { name: en.guidedRequest.families.general }),
  );
  expect(screen.getByLabelText(en.guidedRequest.justification)).toHaveValue(
    "Care requirement",
  );
  unmount();
  render(
    <GuidedRequestForm
      options={{
        ...options,
        requester: { ...options.requester, institute_id: 802 },
      }}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: en.guidedRequest.families.general }),
  );
  expect(screen.getByLabelText(en.guidedRequest.justification)).toHaveValue("");
});
test("invalid quantity prevents preview; API error preserves draft", async () => {
  render(<GuidedRequestForm options={options} />);
  fillGeneral();
  fireEvent.change(screen.getByLabelText(en.guidedRequest.quantity), {
    target: { value: "0" },
  });
  expect(
    screen.getByRole("button", { name: en.guidedRequest.review }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText(en.guidedRequest.quantity), {
    target: { value: "2" },
  });
  previewGuidedRequest.mockRejectedValueOnce({
    response: { data: { message: "Catalog item no longer active" } },
  });
  fireEvent.click(
    screen.getByRole("button", { name: en.guidedRequest.review }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Catalog item no longer active",
  );
  expect(screen.getByLabelText(en.guidedRequest.justification)).toHaveValue(
    "Care requirement",
  );
});
test("oversized attachment gets a clear validation error", () => {
  render(<GuidedRequestForm options={options} />);
  fillGeneral();
  fireEvent.change(screen.getByLabelText(/^Supporting attachments/), {
    target: {
      files: [
        new File(["x".repeat(101)], "evidence.pdf", {
          type: "application/pdf",
        }),
      ],
    },
  });
  expect(screen.getByRole("alert")).toHaveTextContent(
    en.guidedRequest.attachmentLimit,
  );
});
test("feature flag disabled preserves legacy entry without a request", () => {
  render(<GuidedRequestPage />);
  expect(screen.getByText("Legacy forms")).toBeInTheDocument();
  expect(getGuidedOptions).not.toHaveBeenCalled();
});
test("server-disabled flag falls back to legacy", async () => {
  process.env.REACT_APP_GUIDED_REQUESTS_ENABLED = "true";
  getGuidedOptions.mockRejectedValue({ response: { status: 404 } });
  render(<GuidedRequestPage />);
  expect(await screen.findByText("Legacy forms")).toBeInTheDocument();
});

test("restoring a specialist draft retains its fields when choosing the same family", () => {
  const view = render(<GuidedRequestForm options={options} />);
  fireEvent.click(
    screen.getByRole("button", { name: en.guidedRequest.families.it }),
  );
  fireEvent.change(
    screen.getByLabelText(en.guidedRequest.fields.equipment_model),
    { target: { value: "Existing model" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: en.guidedRequest.saveDraft }),
  );
  view.unmount();
  render(<GuidedRequestForm options={options} />);
  fireEvent.click(
    screen.getByRole("button", { name: en.guidedRequest.families.it }),
  );
  expect(
    screen.getByLabelText(en.guidedRequest.fields.equipment_model),
  ).toHaveValue("Existing model");
});
