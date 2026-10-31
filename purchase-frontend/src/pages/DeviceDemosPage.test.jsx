import React from "react";
import i18n from "../i18n";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Page from "./DeviceDemosPage";
import * as api from "../api/deviceDemos";
jest.mock("../api/deviceDemos");
jest.mock("../hooks/useRequestAttachments", () => () => ({
  handleDownloadAttachment: jest.fn(),
}));
const criteria = [
  { key: "technical", name: "Technical performance", weight: 100 },
];
const demo = (id, name) => ({
  id,
  workspace_id: 1,
  supplier_id: id + 10,
  supplier_name: name,
  manufacturer: "Maker",
  model: `Model ${id}`,
  status: "COMPLETED",
  planned_start: "2026-10-01",
  planned_end: "2026-10-29",
  location: "Lab",
  description: "Trial configuration",
  received_at: "2026-10-01T08:00:00Z",
});
const report = (demo_id, score) => ({
  id: demo_id,
  demo_id,
  reviewer_id: 2,
  scores: [{ key: "technical", score: score / 20, comment: "Evidence" }],
  weighted_score: score,
  recommendation: "SUITABLE",
  findings: "Works well",
  safety_findings: "No issues",
  signature: { user_id: 2, name: "Evaluator", role: "HOD" },
  submitted_at: "2026-10-29T08:00:00Z",
});
const workspace = {
  id: 1,
  request_id: 20,
  title: "Imaging device trials",
  objectives: "Compare image quality",
  status: "OPEN",
  row_version: 5,
  current_user_id: 1,
  can_coordinate: true,
  can_decide: false,
  department_name: "Imaging",
  item_snapshot: {
    item_name: "Device",
    quantity: 1,
    unit_of_measure: "Piece",
    specs: "Imaging specs",
  },
  criteria,
  reviewers: [
    {
      reviewer_id: 2,
      name: "Evaluator",
      role: "HOD",
      department_name: "Imaging",
    },
  ],
  demos: [demo(3, "Company A"), demo(4, "Company B")],
  reports: [report(3, 80), report(4, 60)],
  selections: [],
  events: [],
  attachments: [],
};
function mount(path = "/?workspace=1") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Page />
    </MemoryRouter>,
  );
}
beforeEach(async () => {
  await i18n.changeLanguage("en");
  jest.resetAllMocks();
  api.demoSchema.mockResolvedValue({
    can_initiate: true,
    can_coo: false,
    criteria,
  });
  api.listDemos.mockResolvedValue([{ ...workspace, demo_count: 2 }]);
  api.getDemoWorkspace.mockResolvedValue(workspace);
  api.demoOptions.mockResolvedValue({
    suppliers: [
      { id: 13, name: "Company A" },
      { id: 14, name: "Company B" },
    ],
    catalog: [],
  });
  api.demoEvidence.mockResolvedValue([]);
  api.eligibleDemoItems.mockResolvedValue([
    { id: 30, request_id: 20, item_name: "Device", department_name: "Imaging" },
  ]);
  api.demoReviewers.mockResolvedValue([
    { id: 2, name: "Evaluator", role: "HOD", department_name: "Imaging" },
  ]);
});
test("coordinator opens request-item workspace with departmental evaluators and agreed criteria", async () => {
  api.openDemoWorkspace.mockResolvedValue(workspace);
  mount("/");
  await screen.findByText("Open a device demo workspace");
  fireEvent.click(screen.getByText("Open a device demo workspace"));
  fireEvent.change(screen.getByLabelText("Requested device"), {
    target: { value: "30" },
  });
  fireEvent.change(screen.getByLabelText("Demo objectives and intended use"), {
    target: { value: "Assess performance" },
  });
  fireEvent.click(screen.getByLabelText("Evaluator · HOD · Imaging"));
  fireEvent.click(screen.getByText("Open demo workspace"));
  await waitFor(() =>
    expect(api.openDemoWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        request_item_id: "30",
        reviewer_ids: ["2"],
        objectives: "Assess performance",
        criteria,
      }),
    ),
  );
  expect(api.getDemoWorkspace).not.toHaveBeenCalled();
});
test("comparison includes every company and sends selected demo and rationale to COO", async () => {
  api.demoAction.mockResolvedValue({
    ...workspace,
    status: "COO_REVIEW",
    row_version: 6,
  });
  mount();
  await screen.findByText("DEMO-1: Imaging device trials");
  expect(screen.getByText("80.0")).toBeInTheDocument();
  expect(screen.getByText("60.0")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Recommended demo"), {
    target: { value: "3" },
  });
  fireEvent.change(screen.getByLabelText("Demo action notes"), {
    target: { value: "Better image quality in the trial" },
  });
  fireEvent.click(screen.getByText("Send selection to COO"));
  await waitFor(() =>
    expect(api.demoAction).toHaveBeenCalledWith(
      1,
      "recommend",
      expect.objectContaining({
        row_version: 5,
        demo_id: "3",
        notes: "Better image quality in the trial",
      }),
    ),
  );
  expect(screen.queryByText("COO selection decision")).not.toBeInTheDocument();
});
test("unfinished demos or missing evaluator reports prevent recommendation", async () => {
  api.getDemoWorkspace.mockResolvedValue({
    ...workspace,
    reports: [report(3, 80)],
    demos: [
      demo(3, "Company A"),
      { ...demo(4, "Company B"), status: "EVALUATING" },
    ],
  });
  mount();
  await screen.findByText("DEMO-1: Imaging device trials");
  fireEvent.change(screen.getByLabelText("Demo action notes"), {
    target: { value: "Would like to select" },
  });
  fireEvent.change(screen.getByLabelText("Recommended demo"), {
    target: { value: "3" },
  });
  expect(screen.getByText("Send selection to COO")).toBeDisabled();
});
test("COO approves a frozen selection separately from request approval", async () => {
  api.demoSchema.mockResolvedValue({
    can_initiate: false,
    can_coo: true,
    criteria,
  });
  const pending = {
    ...workspace,
    status: "COO_REVIEW",
    can_coordinate: false,
    can_decide: true,
    current_user_id: 9,
    selections: [
      {
        id: 6,
        demo_id: 3,
        status: "PENDING",
        rationale: "Best suitable device",
        submitted_at: "2026-10-29T08:00:00Z",
      },
    ],
  };
  api.getDemoWorkspace.mockResolvedValue(pending);
  api.demoAction.mockResolvedValue({
    ...pending,
    status: "SELECTED",
    can_decide: false,
  });
  mount();
  await screen.findByText("COO selection decision");
  fireEvent.change(screen.getByLabelText("Demo action notes"), {
    target: { value: "Approve company A selection" },
  });
  fireEvent.click(screen.getByText("Approve selected device"));
  await waitFor(() =>
    expect(api.demoAction).toHaveBeenCalledWith(
      1,
      "decision",
      expect.objectContaining({
        row_version: 5,
        decision: "APPROVED",
        notes: "Approve company A selection",
      }),
    ),
  );
  expect(screen.queryByText("Add a supplier demo")).not.toBeInTheDocument();
});
test("assigned evaluator submits evidence without a client signature or computed score", async () => {
  api.demoSchema.mockResolvedValue({
    can_initiate: false,
    can_coo: false,
    criteria,
  });
  const own = {
    ...workspace,
    current_user_id: 2,
    can_coordinate: false,
    reports: [],
  };
  api.getDemoWorkspace.mockResolvedValue(own);
  api.demoAction.mockResolvedValue({ ...own, reports: [report(3, 80)] });
  mount();
  await screen.findByText("DEMO-1: Imaging device trials");
  fireEvent.change(screen.getByLabelText("Supplier demo"), {
    target: { value: "3" },
  });
  fireEvent.change(screen.getByLabelText("Score technical"), {
    target: { value: "4" },
  });
  fireEvent.change(screen.getByLabelText("Evidence technical"), {
    target: { value: "Observed performance" },
  });
  fireEvent.change(screen.getByLabelText("Evaluation findings"), {
    target: { value: "Meets intended use" },
  });
  fireEvent.change(screen.getByLabelText("Safety findings"), {
    target: { value: "No issues observed" },
  });
  fireEvent.change(screen.getByLabelText("Demo suitability"), {
    target: { value: "SUITABLE" },
  });
  fireEvent.click(screen.getByText("Submit evaluation and attest"));
  await waitFor(() =>
    expect(api.demoAction).toHaveBeenCalledWith(
      1,
      "opinion",
      expect.objectContaining({
        demo_id: "3",
        row_version: 5,
        scores: [
          { key: "technical", score: "4", comment: "Observed performance" },
        ],
        recommendation: "SUITABLE",
      }),
    ),
  );
  expect(api.demoAction.mock.calls[0][2]).not.toHaveProperty("signature");
  expect(api.demoAction.mock.calls[0][2]).not.toHaveProperty("weighted_score");
});
test("version conflict preserves rationale and requires deliberate reload", async () => {
  api.demoAction.mockRejectedValue({
    response: {
      status: 409,
      data: { message: "Workspace changed; reload before submitting" },
    },
  });
  mount();
  await screen.findByText("DEMO-1: Imaging device trials");
  fireEvent.change(screen.getByLabelText("Recommended demo"), {
    target: { value: "3" },
  });
  fireEvent.change(screen.getByLabelText("Demo action notes"), {
    target: { value: "Keep my rationale" },
  });
  fireEvent.click(screen.getByText("Send selection to COO"));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Demo action notes")).toHaveValue(
    "Keep my rationale",
  );
  expect(api.getDemoWorkspace).toHaveBeenCalledTimes(1);
});

test("specification sheets attach directly to the workspace before any company demo arrives", async () => {
  const empty = { ...workspace, demos: [], reports: [] };
  const file = new File(["%PDF fixture"], "device-specification.pdf", {
    type: "application/pdf",
  });
  const attachment = { id: 55, file_name: file.name };
  const event = {
    id: 90,
    action: "DEVICE_DEMO_DOCUMENT",
    notes: `Supporting document: ${file.name}`,
    attachment_ids: [55],
    actor_snapshot: { name: "Coordinator" },
    created_at: "2026-10-29T08:00:00Z",
  };
  api.getDemoWorkspace.mockResolvedValue(empty);
  api.uploadDemoEvidence.mockResolvedValue({ attachmentId: 55 });
  api.demoEvidence.mockResolvedValue([attachment]);
  api.demoAction.mockResolvedValue({
    ...empty,
    row_version: 6,
    attachments: [attachment],
    events: [event],
  });
  mount();
  await screen.findByRole("heading", { name: "Workspace documents" });
  fireEvent.change(screen.getByLabelText("Upload workspace document"), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect(api.uploadDemoEvidence).toHaveBeenCalledWith(20, file),
  );
  await waitFor(() =>
    expect(api.demoAction).toHaveBeenCalledWith(1, "document", {
      row_version: 5,
      notes: `Supporting document: ${file.name}`,
      attachment_ids: [55],
    }),
  );
  expect(
    await screen.findByText("Files attached to the demo workspace."),
  ).toBeInTheDocument();
  expect(screen.getAllByText(file.name).length).toBeGreaterThan(0);
  expect(api.demoAction.mock.calls[0][2]).not.toHaveProperty("demo_id");
});

test("attaching a data sheet preserves an unsaved evaluator report", async () => {
  const own = {
    ...workspace,
    current_user_id: 2,
    can_coordinate: false,
    reports: [],
  };
  api.demoSchema.mockResolvedValue({
    can_initiate: false,
    can_coo: false,
    criteria,
  });
  api.getDemoWorkspace.mockResolvedValue(own);
  api.uploadDemoEvidence.mockResolvedValue({ attachmentId: 56 });
  api.demoAction.mockResolvedValue({
    ...own,
    row_version: 6,
    attachments: [{ id: 56, file_name: "data-sheet.pdf" }],
  });
  mount();
  await screen.findByText("DEMO-1: Imaging device trials");
  fireEvent.change(screen.getByLabelText("Supplier demo"), {
    target: { value: "3" },
  });
  fireEvent.change(screen.getByLabelText("Evaluation findings"), {
    target: { value: "Keep this trial assessment" },
  });
  fireEvent.change(screen.getByLabelText("Score technical"), {
    target: { value: "4" },
  });
  fireEvent.change(screen.getByLabelText("Upload workspace document"), {
    target: {
      files: [
        new File(["data"], "data-sheet.pdf", { type: "application/pdf" }),
      ],
    },
  });
  await screen.findByText("Files attached to the demo workspace.");
  expect(screen.getByLabelText("Evaluation findings")).toHaveValue(
    "Keep this trial assessment",
  );
  expect(screen.getByLabelText("Score technical")).toHaveValue("4");
});

test("registers a demo against an existing supplier ID without separate company setup", async () => {
  api.demoAction.mockResolvedValue(workspace);
  mount();
  const select = await screen.findByLabelText("Supplier");
  await waitFor(() => expect(select).not.toBeDisabled());
  expect(
    screen.getByRole("option", { name: "Select supplier" }),
  ).toBeInTheDocument();
  fireEvent.change(select, { target: { value: "13" } });
  fireEvent.change(screen.getByLabelText(/manufacturer/i), {
    target: { value: "Device maker" },
  });
  fireEvent.change(screen.getByLabelText(/model/i), {
    target: { value: "Device 100" },
  });
  fireEvent.change(screen.getByLabelText(/location/i), {
    target: { value: "Imaging" },
  });
  fireEvent.change(screen.getByLabelText(/planned start/i), {
    target: { value: "2026-10-30" },
  });
  fireEvent.change(screen.getByLabelText(/planned end/i), {
    target: { value: "2026-11-10" },
  });
  fireEvent.change(screen.getByLabelText("Demo configuration / description"), {
    target: { value: "Trial settings" },
  });
  fireEvent.change(screen.getByLabelText("Supplier demo registration notes"), {
    target: { value: "Supplier confirmed loan" },
  });
  fireEvent.click(screen.getByText("Save supplier demo"));
  await waitFor(() =>
    expect(api.demoAction).toHaveBeenCalledWith(
      1,
      "candidate",
      expect.objectContaining({
        supplier_id: "13",
        manufacturer: "Device maker",
        model: "Device 100",
        notes: "Supplier confirmed loan",
      }),
    ),
  );
});
test("supplier load failure is visible beside the selector and retry preserves registration drafts", async () => {
  api.demoOptions.mockRejectedValueOnce({
    response: {
      data: { message: "Missing public.suppliers.institute_id; apply SQL 052" },
    },
  });
  mount();
  await screen.findByText(
    "Missing public.suppliers.institute_id; apply SQL 052",
  );
  expect(screen.getByLabelText("Supplier")).toBeDisabled();
  expect(screen.getByText("Save supplier demo")).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/model/i), {
    target: { value: "Keep device model" },
  });
  fireEvent.change(screen.getByLabelText("Supplier demo registration notes"), {
    target: { value: "Keep notes" },
  });
  fireEvent.click(screen.getByText("Reload suppliers"));
  await waitFor(() =>
    expect(screen.getByLabelText("Supplier")).not.toBeDisabled(),
  );
  expect(screen.getByLabelText(/model/i)).toHaveValue("Keep device model");
  expect(screen.getByLabelText("Supplier demo registration notes")).toHaveValue(
    "Keep notes",
  );
  expect(api.getDemoWorkspace).toHaveBeenCalledTimes(1);
  expect(api.demoAction).not.toHaveBeenCalled();
});
test("an empty eligible supplier directory explains setup and cannot submit a demo", async () => {
  api.demoOptions.mockResolvedValue({ suppliers: [], catalog: [] });
  mount();
  await screen.findByText(/No eligible suppliers are available/);
  expect(screen.getByLabelText("Supplier")).toBeDisabled();
  expect(screen.getByText("Save supplier demo")).toBeDisabled();
});
test("reloading clears a supplier which is no longer eligible without losing other configuration", async () => {
  mount();
  await waitFor(() =>
    expect(screen.getByLabelText("Supplier")).not.toBeDisabled(),
  );
  fireEvent.change(screen.getByLabelText("Supplier"), {
    target: { value: "13" },
  });
  fireEvent.change(screen.getByLabelText(/model/i), {
    target: { value: "Keep model" },
  });
  api.demoOptions.mockResolvedValueOnce({
    suppliers: [{ id: 14, name: "Company B" }],
    catalog: [],
  });
  fireEvent.click(screen.getByText("Reload suppliers"));
  await waitFor(() =>
    expect(screen.getByLabelText("Supplier")).toHaveValue(""),
  );
  expect(screen.getByLabelText(/model/i)).toHaveValue("Keep model");
  expect(screen.getByText("Save supplier demo")).toBeDisabled();
});

test("evaluator search preserves hidden selections and the setup summary", async () => {
  api.demoReviewers.mockResolvedValue([
    { id: 2, name: "Evaluator", role: "HOD", department_name: "Imaging" },
    {
      id: 3,
      name: "Other reviewer",
      role: "Requester",
      department_name: "ICU",
    },
  ]);
  mount("/");
  fireEvent.click(
    await screen.findByRole("button", { name: "New demo workspace" }),
  );
  expect(
    screen.getByRole("form", { name: "Open device demo workspace" }),
  ).toBeVisible();
  fireEvent.click(screen.getByLabelText("Evaluator · HOD · Imaging"));
  fireEvent.change(screen.getByRole("searchbox", { name: "Find evaluators" }), {
    target: { value: "Other ICU" },
  });
  expect(
    screen.queryByLabelText("Evaluator · HOD · Imaging"),
  ).not.toBeInTheDocument();
  expect(screen.getByText("1 selected · 1 of 2 shown")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Clear evaluator search" }),
  );
  expect(screen.getByLabelText("Evaluator · HOD · Imaging")).toBeChecked();
  expect(
    screen.getByRole("complementary", { name: "Demo setup summary" }),
  ).toBeInTheDocument();
  expect(api.openDemoWorkspace).not.toHaveBeenCalled();
  expect(api.demoAction).not.toHaveBeenCalled();
});

test("weight feedback and submit guard enforce the existing 100 percent rule", async () => {
  mount("/");
  fireEvent.click(
    await screen.findByRole("button", { name: "New demo workspace" }),
  );
  fireEvent.change(screen.getByLabelText("Requested device"), {
    target: { value: "30" },
  });
  fireEvent.change(screen.getByLabelText("Demo objectives and intended use"), {
    target: { value: "Clinical performance" },
  });
  fireEvent.click(screen.getByLabelText("Evaluator · HOD · Imaging"));
  fireEvent.change(screen.getByLabelText("Weight 1"), {
    target: { value: "70" },
  });
  expect(screen.getByText("Weight total: 70%")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Open demo workspace", exact: true }),
  ).toBeDisabled();
  fireEvent.submit(
    screen.getByRole("form", { name: "Open device demo workspace" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "positive whole numbers totaling 100%",
  );
  expect(api.openDemoWorkspace).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Weight 1"), {
    target: { value: "100" },
  });
  expect(screen.getByText("Weight total: 100%")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Open demo workspace", exact: true }),
  ).toBeEnabled();
});

test("read-only search reset cannot expose workspace setup or eligible item lookup", async () => {
  api.demoSchema.mockResolvedValue({
    can_initiate: false,
    can_coo: false,
    criteria,
  });
  mount("/");
  await screen.findByRole("button", { name: "Open DEMO-1" });
  expect(
    screen.queryByRole("button", { name: "New demo workspace" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Search demos" }), {
    target: { value: "Device" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search", exact: true }));
  await waitFor(() => expect(api.listDemos).toHaveBeenCalledWith("Device"));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Clear search" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  await waitFor(() => expect(api.listDemos).toHaveBeenLastCalledWith(""));
  expect(api.eligibleDemoItems).not.toHaveBeenCalled();
  expect(api.openDemoWorkspace).not.toHaveBeenCalled();
});


test("Arabic demo workspace translates supplier controls and keeps supplier IDs and descriptions intact", async () => {
  await i18n.changeLanguage("ar");
  api.demoAction.mockResolvedValue(workspace);
  mount();
  const supplier = await screen.findByLabelText("المورّد");
  expect(screen.getByRole("heading", { name: "مساحة عمل تجارب الأجهزة" })).toBeInTheDocument();
  expect(screen.getByText("من إعداد التجربة إلى اعتماد الاختيار")).toBeInTheDocument();
  await waitFor(() => expect(supplier).not.toBeDisabled());
  fireEvent.change(supplier, { target: { value: "13" } });
  for (const [label, value] of [["الشركة المصنّعة", "Device maker"], ["الطراز", "Device 100"], ["الموقع", "Imaging"], ["بداية التجربة المخططة", "2026-10-30"], ["نهاية التجربة المخططة", "2026-11-10"], ["تجهيز الجهاز التجريبي / الوصف", "Trial settings"], ["ملاحظات تسجيل تجربة المورد", "Supplier confirmed loan"]]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByText("حفظ تجربة المورد"));
  await waitFor(() => expect(api.demoAction).toHaveBeenCalledWith(1, "candidate", expect.objectContaining({ supplier_id: "13", model: "Device 100", notes: "Supplier confirmed loan" })));
  await act(async () => { await i18n.changeLanguage("en"); });
});
