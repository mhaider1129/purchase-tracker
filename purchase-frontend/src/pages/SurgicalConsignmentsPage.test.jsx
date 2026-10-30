import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Page from "./SurgicalConsignmentsPage";
import * as api from "../api/surgicalConsignments";
jest.mock("../api/surgicalConsignments");
jest.mock("file-saver", () => ({ saveAs: jest.fn() }));
const signed = { name: "Nurse", role: "Requester", user_id: 3 };
const lot = {
  id: 11,
  receipt_id: 21,
  item_name: "Screw",
  catalogue_code: "SIZE35",
  batch_number: "LOT1",
  expiry_date: "2030-01-01",
  delivered_quantity: 10,
  unit_price: "10.0000",
  sterile_intact: true,
  accepted: true,
};
const balance = {
  ...lot,
  receipt_line_id: 11,
  used_quantity: 3,
  damaged_quantity: 0,
  missing_quantity: 0,
  returned_intact: 7,
  returned_damaged: 0,
  remaining_intact: 0,
  unresolved_exception: false,
  billable_quantity: 3,
  billing_description: "Screw [SIZE35] / lot LOT1",
  line_amount: "30.00",
};
const record = {
  id: 7,
  row_version: 1,
  status: "RECONCILING",
  clinical_access: true,
  can_scm: false,
  current_user_id: 3,
  department_name: "Surgery",
  supplier_id: 9,
  supplier_name: "Company",
  currency: "IQD",
  surgery_date: "2026-10-29",
  procedure_event_date: "2026-10-29",
  procedure_outcome: "PERFORMED",
  patient_mrn: "PRIVATE-MRN-FIXTURE",
  procedure_type: "Test procedure",
  requester_snapshot: { name: "Requester", role: "Requester" },
  surgeon_id: 2,
  surgeon_name: "Surgeon",
  nurse_id: 3,
  nurse_name: "Nurse",
  receiver_id: 4,
  receiver_name: "Receiver",
  vendor_contact: "Contact",
  agreement_reference: "Agreement",
  authorization_code: "SCN-1-7",
  justification: ["PATIENT_SPECIFIC"],
  requested_items: [
    {
      item_name: "Screw range",
      quantity: 20,
      catalogue_code: "FAMILY",
      functional_specs: "Size range",
    },
  ],
  approvals: [
    {
      step: 1,
      role: "DEPARTMENT_MANAGER",
      approver_id: 5,
      name: "Manager",
      status: "APPROVED",
    },
    { step: 2, role: "CMO", approver_id: 6, name: "CMO", status: "APPROVED" },
    { step: 3, role: "SCM", approver_id: 8, name: "SCM", status: "APPROVED" },
  ],
  receipts: [
    {
      id: 21,
      confirmed_at: "2026-10-29T08:00:00Z",
      delivery_reference: "DEL-1",
      received_date: "2026-10-29",
      location: "OR",
      vendor_representative: "Rep",
      receiver_signature: { name: "Receiver" },
      scm_signature: { name: "SCM" },
    },
  ],
  lines: [lot],
  usage: [
    {
      receipt_line_id: 11,
      used_quantity: 3,
      damaged_quantity: 0,
      missing_quantity: 0,
      notes: "As recorded",
    },
  ],
  balance: [balance],
  amount: "30.00",
  returns: [],
  waivers: [],
  attestations: [],
  files: [],
  events: [],
  billing_lines: [],
  usage_snapshot: null,
};
const meta = {
  can_create: false,
  current_user_id: 3,
  file_purposes: ["AGREEMENT", "RECEIPT", "RETURN", "USAGE", "WAIVER", "OTHER"],
};
function mount(path = "/?case=7") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Page />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  jest.resetAllMocks();
  api.schema.mockResolvedValue(meta);
  api.list.mockResolvedValue([{ ...record }]);
  api.get.mockResolvedValue(record);
  api.routing.mockResolvedValue({
    surgeon: { id: 1, name: "Submitting surgeon" },
    nurse: { id: 3, name: "Nurse" },
    receiver: { id: 4, name: "Receiver" },
    manager: { id: 5, name: "Manager" },
    cmo: { id: 6, name: "CMO" },
    scm: { id: 8, name: "SCM" },
    warehouse: { id: 11, name: "Surgical warehouse" },
  });
  api.options.mockResolvedValue({
    configured: true,
    sections: [],
    departments: [{ id: 1, name: "Surgery" }],
    users: [
      { id: 2, name: "Surgeon", role: "Requester", department_id: 1 },
      { id: 3, name: "Nurse", role: "Requester", department_id: 1 },
      { id: 4, name: "Receiver", role: "WarehouseKeeper", department_id: 1 },
      {
        id: 5,
        name: "Manager",
        role: "HOD",
        department_id: 1,
        is_department_manager: true,
      },
      { id: 6, name: "CMO", role: "CMO", department_id: 1 },
      { id: 8, name: "SCM", role: "SCM", department_id: 1 },
    ],
    suppliers: [{ id: 9, name: "Company" }],
    reasons: ["PATIENT_SPECIFIC"],
  });
});
async function notes(value = "Verified quantities") {
  await screen.findByText("SC-7 · Company");
  fireEvent.change(screen.getByLabelText("Consignment action notes"), {
    target: { value },
  });
}
async function checks() {
  fireEvent.click(
    screen.getByLabelText(
      "I confirm the used, returned and discrepancy quantities shown in the usage record.",
    ),
  );
  fireEvent.click(
    screen.getByLabelText(
      "The vendor has been informed of usage and return status.",
    ),
  );
  fireEvent.click(
    screen.getByLabelText(
      "I understand only confirmed used quantities enter the normal bill; exceptions require separate resolution.",
    ),
  );
}
test("nurse signs a reconciled F20 snapshot with explicit quantity/vendor/billing attestations", async () => {
  api.action.mockResolvedValue({
    ...record,
    status: "USAGE_REVIEW",
    row_version: 2,
    attestations: [
      { role: "NURSE", signature: signed, created_at: "2026-10-29T08:00:00Z" },
    ],
  });
  mount();
  await notes();
  await checks();
  fireEvent.click(screen.getByText("Sign final usage record"));
  await waitFor(() =>
    expect(api.action).toHaveBeenCalledWith(7, "attest", {
      row_version: 1,
      notes: "Verified quantities",
      confirm_quantities: true,
      vendor_informed: true,
      acknowledge_used_billing: true,
    }),
  );
  expect(api.action.mock.calls[0][2]).not.toHaveProperty("signature");
});
test("outstanding intact returns prevent final F20 attestation", async () => {
  api.get.mockResolvedValue({
    ...record,
    balance: [{ ...balance, returned_intact: 0, remaining_intact: 7 }],
  });
  mount();
  await notes();
  await checks();
  expect(screen.getByText("Sign final usage record")).toBeDisabled();
  expect(api.action).not.toHaveBeenCalled();
});
test("finance-only case data renders a usage billing packet without clinical identifiers or files", async () => {
  api.schema.mockResolvedValue({ ...meta, current_user_id: 10 });
  api.get.mockResolvedValue({
    id: 7,
    current_user_id: 10,
    clinical_access: false,
    status: "RECONCILED",
    supplier_name: "Company",
    currency: "IQD",
    balance: [
      {
        receipt_line_id: 11,
        billing_description: balance.billing_description,
        billable_quantity: 3,
        unit_price: "10",
        line_amount: "30.00",
      },
    ],
    amount: "30.00",
  });
  mount();
  await screen.findByText("Confirmed used-items billing packet");
  expect(screen.getByText(balance.billing_description)).toBeInTheDocument();
  expect(screen.queryByText(/PRIVATE-MRN-FIXTURE/)).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Upload private consignment document"),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/F18 · Surgical/)).not.toBeInTheDocument();
});
test("private agreement upload uses scoped API and preserves an unfinished usage draft", async () => {
  const c = { ...record, status: "RECEIVED", balance: [], usage: [] };
  api.get.mockResolvedValue(c);
  api.upload.mockResolvedValue({
    ...c,
    row_version: 2,
    files: [
      {
        id: 99,
        file_name: "agreement.pdf",
        purpose: "AGREEMENT",
        uploaded_by_name: "Nurse",
      },
    ],
  });
  mount();
  await notes();
  fireEvent.change(screen.getByLabelText("Usage used_quantity 11"), {
    target: { value: "3" },
  });
  const file = new File(["%PDF private fixture"], "agreement.pdf", {
    type: "application/pdf",
  });
  fireEvent.change(
    screen.getByLabelText("Upload private consignment document"),
    { target: { files: [file] } },
  );
  await waitFor(() =>
    expect(api.upload).toHaveBeenCalledWith(7, file, "AGREEMENT"),
  );
  await screen.findByText("Private document attached.");
  expect(screen.getByLabelText("Usage used_quantity 11")).toHaveValue(3);
});
test("stale row conflicts retain user notes until deliberate reload", async () => {
  api.action.mockRejectedValue({
    response: {
      status: 409,
      data: { message: "Consignment changed; reload before submitting" },
    },
  });
  mount();
  await notes("Keep my review");
  await checks();
  fireEvent.click(screen.getByText("Sign final usage record"));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Consignment action notes")).toHaveValue(
    "Keep my review",
  );
  expect(api.get).toHaveBeenCalledTimes(1);
});
test("the surgeon submits clinical need and a free-text vendor recommendation without staff or commercial selections", async () => {
  api.schema.mockResolvedValue({
    ...meta,
    can_create: true,
    current_user_id: 1,
  });
  api.create.mockResolvedValue({ ...record, status: "AWAITING_AUTHORIZATION" });
  mount("/");
  fireEvent.click(await screen.findByText("New surgical consignment request"));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Submit request for authorization" }),
    ).not.toBeDisabled(),
  );
  for (const [field, value] of [
    ["Expected surgery date", "2026-10-30"],
    ["Patient MRN", "MRN-F18"],
    ["Procedure type", "Test procedure"],
    [
      "Vendor recommendation (optional)",
      "A surgeon suggested vendor not in the directory",
    ],
  ])
    fireEvent.change(screen.getByLabelText(field, { exact: true }), {
      target: { value },
    });
  for (const [field, value] of [
    ["item_name", "Screws range"],
    ["functional_specs", "Multiple lengths"],
  ])
    fireEvent.change(screen.getByLabelText(`Requested ${field} 1`), {
      target: { value },
    });
  expect(
    screen.queryByLabelText("Assigned surgeon", { exact: true }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Vendor agreement / price-list reference", {
      exact: true,
    }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Submit request for authorization"));
  await waitFor(() =>
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        patient_mrn: "MRN-F18",
        department_id: "1",
        recommended_vendor: "A surgeon suggested vendor not in the directory",
        justification: ["SURGEON_REQUEST"],
      }),
    ),
  );
  const payload = api.create.mock.calls[0][0];
  for (const field of [
    "surgeon_id",
    "nurse_id",
    "receiver_id",
    "manager_id",
    "cmo_id",
    "scm_id",
    "supplier_id",
    "agreement_reference",
  ])
    expect(payload).not.toHaveProperty(field);
});

test("a cancelled procedure can prepare a zero-use return reconciliation without pretending surgery occurred", async () => {
  const c = {
    ...record,
    status: "RECEIVED",
    usage: [],
    balance: [],
    procedure_event_date: null,
  };
  api.get.mockResolvedValue(c);
  api.action.mockResolvedValue({
    ...c,
    status: "RECONCILING",
    procedure_outcome: "CANCELLED",
  });
  mount();
  await notes("Procedure cancelled; all units unused");
  fireEvent.change(screen.getByLabelText("Procedure outcome"), {
    target: { value: "CANCELLED" },
  });
  fireEvent.click(screen.getByText("Save usage draft"));
  await waitFor(() =>
    expect(api.action).toHaveBeenCalledWith(
      7,
      "save_usage",
      expect.objectContaining({
        procedure_outcome: "CANCELLED",
        lines: [
          expect.objectContaining({
            used_quantity: 0,
            damaged_quantity: 0,
            missing_quantity: 0,
          }),
        ],
      }),
    ),
  );
});

test("new request shortcut opens the grouped form and range removal preserves the remaining draft", async () => {
  api.schema.mockResolvedValue({
    ...meta,
    can_create: true,
    current_user_id: 1,
  });
  mount("/");
  fireEvent.click(
    await screen.findByRole("button", { name: "New request", exact: true }),
  );
  expect(
    screen.getByRole("form", { name: "Surgical consignment request" }),
  ).toBeVisible();
  expect(
    screen.getByRole("group", { name: /Case details/ }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("group", { name: /Vendor agreement/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("group", { name: /Team and authorization/ }),
  ).not.toBeInTheDocument();
  fireEvent.change(
    screen.getByLabelText("Surgical department", { exact: true }),
    { target: { value: "1" } },
  );
  fireEvent.change(
    screen.getByLabelText("Vendor recommendation (optional)", { exact: true }),
    {
      target: { value: "Suggested supplier" },
    },
  );
  fireEvent.change(screen.getByLabelText("Requested item_name 1"), {
    target: { value: "Retained range" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add requested range" }));
  expect(screen.getByLabelText("Requested item_name 2")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Remove requested range 2" }),
  );
  expect(
    screen.queryByLabelText("Requested item_name 2"),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Requested item_name 1")).toHaveValue(
    "Retained range",
  );
  expect(
    screen.queryByRole("button", { name: "Remove requested range 1" }),
  ).not.toBeInTheDocument();
  expect(api.create).not.toHaveBeenCalled();
  expect(api.action).not.toHaveBeenCalled();
});

test("queue status and search can be cleared without workflow mutations", async () => {
  api.list.mockResolvedValue([
    { ...record },
    { ...record, id: 8, status: "AUTHORIZED" },
  ]);
  mount("/");
  await screen.findByRole("button", { name: "Open SC-7" });
  fireEvent.change(screen.getByLabelText("Queue status"), {
    target: { value: "AUTHORIZED" },
  });
  expect(
    screen.queryByRole("button", { name: "Open SC-7" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open SC-8" })).toBeInTheDocument();
  api.list.mockResolvedValueOnce([{ ...record }]);
  fireEvent.change(
    screen.getByRole("textbox", { name: "Search surgical consignments" }),
    { target: { value: "Company" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Search", exact: true }));
  await waitFor(() => expect(api.list).toHaveBeenCalledWith("Company"));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Search", exact: true }),
    ).toBeEnabled(),
  );
  expect(screen.getByLabelText("Queue status")).toHaveValue("AUTHORIZED");
  expect(
    screen.getByText(
      "No consignments match the current search and status filters.",
    ),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Clear search and filters" }),
  );
  await screen.findByRole("button", { name: "Open SC-7" });
  expect(screen.getByLabelText("Queue status")).toHaveValue("");
  expect(api.list).toHaveBeenLastCalledWith("");
  expect(api.create).not.toHaveBeenCalled();
  expect(api.action).not.toHaveBeenCalled();
});

test("read-only queue does not expose the creation form or patient identifiers", async () => {
  mount("/");
  await screen.findByRole("button", { name: "Open SC-7" });
  expect(
    screen.queryByRole("button", { name: "New request", exact: true }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("form", { name: "Surgical consignment request" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(record.patient_mrn)).not.toBeInTheDocument();
});

test("unconfigured or ambiguous automatic assignments block only new submissions with actionable guidance", async () => {
  api.schema.mockResolvedValue({
    ...meta,
    can_create: true,
    current_user_id: 1,
  });
  api.routing.mockRejectedValueOnce({
    response: {
      data: { message: "Expected one active CMO; found 2. Review Management." },
    },
  });
  mount("/");
  fireEvent.click(await screen.findByText("New surgical consignment request"));
  await screen.findByText(
    "Expected one active CMO; found 2. Review Management.",
  );
  expect(
    screen.getByRole("button", { name: "Submit request for authorization" }),
  ).toBeDisabled();
  expect(api.create).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Patient MRN", { exact: true }), {
    target: { value: "Keep clinical draft" },
  });
  fireEvent.click(screen.getByText("Retry team assignment"));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Submit request for authorization" }),
    ).not.toBeDisabled(),
  );
  expect(screen.getByLabelText("Patient MRN", { exact: true })).toHaveValue(
    "Keep clinical draft",
  );
});
test("SCM confirms the supplier and commercial reference at authorization, separately from the surgeon recommendation", async () => {
  const c = {
    ...record,
    status: "AWAITING_AUTHORIZATION",
    current_user_id: 8,
    can_scm: true,
    supplier_id: null,
    supplier_name: null,
    vendor_contact: null,
    agreement_reference: null,
    recommended_vendor: "Surgeon preferred company",
    approvals: record.approvals.map((a) =>
      a.role === "SCM" ? { ...a, status: "PENDING" } : a,
    ),
    files: [{ id: 22, purpose: "AGREEMENT", file_name: "Supplier quote.pdf" }],
  };
  api.schema.mockResolvedValue({
    ...meta,
    can_create: true,
    current_user_id: 8,
  });
  api.get.mockResolvedValue(c);
  api.action.mockResolvedValue({ ...c, status: "AUTHORIZED" });
  mount();
  await screen.findByText(/Surgeon recommendation: Surgeon preferred company/);
  fireEvent.change(screen.getByLabelText("Confirmed supplier"), {
    target: { value: "9" },
  });
  fireEvent.change(screen.getByLabelText("Supplier contact", { exact: true }), {
    target: { value: "Vendor phone" },
  });
  fireEvent.change(
    screen.getByLabelText("Vendor agreement / price-list reference", {
      exact: true,
    }),
    { target: { value: "Supplier quote Q-53" } },
  );
  fireEvent.change(screen.getByLabelText("Agreement evidence"), {
    target: { value: "22" },
  });
  fireEvent.click(screen.getByLabelText(/I acknowledge vendor ownership/));
  fireEvent.change(screen.getByLabelText("Consignment action notes"), {
    target: { value: "Commercial terms confirmed" },
  });
  fireEvent.click(screen.getByText("Approve consignment authorization"));
  await waitFor(() =>
    expect(api.action).toHaveBeenCalledWith(
      7,
      "approve",
      expect.objectContaining({
        supplier_id: "9",
        vendor_contact: "Vendor phone",
        agreement_reference: "Supplier quote Q-53",
        agreement_file_id: "22",
      }),
    ),
  );
});
