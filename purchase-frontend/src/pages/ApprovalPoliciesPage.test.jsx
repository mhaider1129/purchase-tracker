import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApprovalPoliciesPage, {
  VersionDetail,
  ShadowComparison,
  PolicySimulator,
} from "./ApprovalPoliciesPage";
import * as api from "../api/approvalPolicies";
import { getOrganizationOptions } from "../api/organization";
jest.mock("../api/approvalPolicies");
jest.mock("../api/organization");
test('simulator uses the canonical Non-Stock default, keeps zero amount and displays diagnostics', async () => {
  api.simulateApprovalPolicy.mockResolvedValue({ policy: { name: 'Non-Stock', versionNumber: 1, versionId: 12, status: 'SHADOW', activeRuleCount: 0, ruleCount: 0 }, matchedRules: [], steps: [], ruleDiagnostics: [] });
  render(<PolicySimulator versions={[{ id: 12, version_number: 1, policyName: 'Non-Stock' }]} />);
  expect(screen.getByLabelText('Simulation request type')).toHaveValue('Non-Stock');
  await userEvent.selectOptions(screen.getByLabelText('Simulation policy version'), '12');
  await userEvent.type(screen.getByLabelText('Estimated amount'), '0');
  await userEvent.click(screen.getByRole('button', { name: /Simulate route/ }));
  await screen.findByText(/no active rules/);
  expect(api.simulateApprovalPolicy).toHaveBeenCalledWith('12', expect.objectContaining({ requestType: 'Non-Stock', estimatedAmount: '0', isStockRequest: false }));
});
test('policy editor preserves stored lowercase classifications while offering canonical choices', () => {
  render(<VersionDetail onRefresh={jest.fn()} version={{ id: 12, status: 'SHADOW', rules: [{ code: 'MED', priority: 1, conditions: [{ type: 'DEPARTMENT_CLASSIFICATION_EQUALS', value: 'medical' }], steps: [] }] }} />);
  expect(screen.getByLabelText('Condition 1 value')).toHaveValue('medical');
  expect(screen.getByRole('option', { name: 'medical (stored value)' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Medical' })).toHaveValue('Medical');
});
test('shadow comparison shows recorded rule diagnostics and a neutral legacy-purpose label', () => {
  render(<ShadowComparison run={{ currentRoute: [{ approvalLevel: 1, userId: 3, semanticKey: 'LEGACY_SEMANTIC_UNKNOWN' }], steps: [], summary: { policy: { name: 'Non-Stock', versionNumber: 1, versionId: 12, status: 'SHADOW', activeRuleCount: 1, ruleCount: 1 }, ruleDiagnostics: [{ code: 'NONSTOCK_MED_HIGH', priority: 1, result: 'NO MATCH', selected: false, conditions: [{ type: 'REQUEST_TYPE_EQUALS', configuredValue: 'NON-STOCK', expected: 'NON-STOCK', actual: 'Non-Stock', result: 'FAIL' }] }] } }} />);
  expect(screen.queryByText('LEGACY_SEMANTIC_UNKNOWN')).not.toBeInTheDocument();
  expect(screen.getByText('Legacy approval — purpose unavailable')).toBeInTheDocument();
  expect(screen.getByText('NONSTOCK_MED_HIGH · NO MATCH')).toBeInTheDocument();
  expect(screen.getByText('FAIL')).toBeInTheDocument();
});
beforeEach(() => {
  jest.clearAllMocks();
  getOrganizationOptions.mockResolvedValue({
    departments: [],
    users: [],
    positions: [],
  });
  api.listShadowRuns.mockResolvedValue([]);
});
test("policy list loads and creates a policy in the authenticated institute", async () => {
  api.listApprovalPolicies.mockResolvedValue([
    {
      id: 1,
      name: "Standard",
      code: "STD",
      institute_id: 1,
      shadow_status: "SHADOW",
    },
  ]);
  api.createApprovalPolicy.mockResolvedValue({
    id: 2,
    name: "New",
    code: "NEW",
  });
  render(<ApprovalPoliciesPage />);
  expect(screen.getByText(/Loading/)).toBeInTheDocument();
  expect(await screen.findByText("Standard")).toBeInTheDocument();
  await userEvent.click(screen.getByText("Create Policy"));
  await userEvent.type(screen.getByLabelText("Name"), "New");
  await userEvent.type(screen.getByLabelText("Code"), "NEW");
  expect(screen.queryByLabelText("Institute")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(await screen.findByText("New")).toBeInTheDocument();
  expect(api.createApprovalPolicy).toHaveBeenCalledWith({
    name: "New",
    code: "NEW",
    description: "",
  });
});
test("list renders API failure", async () => {
  api.listApprovalPolicies.mockRejectedValue(new Error("down"));
  render(<ApprovalPoliciesPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("down");
});
test("open policy uses the routed policy URL instead of fetching from the registry click", async () => {
  const onOpenPolicy = jest.fn();
  api.listApprovalPolicies.mockResolvedValue([
    { id: 12, name: "Medical Stock", code: "MED" },
  ]);
  render(<ApprovalPoliciesPage onOpenPolicy={onOpenPolicy} />);
  await userEvent.click(
    await screen.findByRole("button", { name: /Open Policy/ }),
  );
  expect(onOpenPolicy).toHaveBeenCalledWith(12);
  expect(api.getApprovalPolicy).not.toHaveBeenCalled();
});
test("routed policy id loads and displays the policy detail", async () => {
  api.listApprovalPolicies.mockResolvedValue([]);
  api.getApprovalPolicy.mockResolvedValue({
    id: 12,
    name: "Medical Stock",
    code: "MED",
    versions: [],
  });
  render(<ApprovalPoliciesPage policyId="12" onClosePolicy={jest.fn()} />);
  expect(
    await screen.findByRole("heading", { name: "Medical Stock" }),
  ).toBeInTheDocument();
  expect(api.getApprovalPolicy).toHaveBeenCalledWith("12");
});
test("new draft version appears in the version history immediately", async () => {
  api.getApprovalPolicy.mockResolvedValue({
    id: 12,
    name: "Medical Stock",
    code: "MED",
    versions: [],
  });
  api.createApprovalPolicyVersion.mockResolvedValue({
    id: 21,
    version_number: 1,
    status: "DRAFT",
    rules: [],
  });
  render(<ApprovalPoliciesPage policyId="12" onClosePolicy={jest.fn()} />);
  await screen.findByRole("heading", { name: "Medical Stock" });
  expect(screen.getByText("0 versions")).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: /Create Draft Version/ }),
  );
  expect(await screen.findByText("1 version")).toBeInTheDocument();
  expect(screen.getByText("v1")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Version 1" }),
  ).toBeInTheDocument();
});
test("draft validates and only a validated version can enter shadow", async () => {
  api.validateApprovalPolicyVersion.mockResolvedValue({
    valid: false,
    errors: ["semantic key required"],
  });
  api.enterApprovalPolicyShadow.mockResolvedValue({});
  const refresh = jest.fn();
  const value = {
    id: 4,
    status: "DRAFT",
    version_number: 1,
    rules: [
      {
        id: 1,
        name: "Base",
        priority: 1,
        conditions: [{ type: "REQUEST_TYPE_EQUALS", value: "PR" }],
        steps: [
          {
            approvalLevel: 1,
            stepOrder: 1,
            resolverType: "DEPARTMENT_HEAD",
            semanticKey: "DEPARTMENT_AUTHORIZATION",
            displayName: "Department",
          },
        ],
      },
    ],
  };
  const { rerender } = render(
    <VersionDetail version={value} onRefresh={refresh} />,
  );
  expect(screen.getByLabelText("Condition 1 type")).toBeEnabled();
  await userEvent.click(screen.getByText("Validate"));
  expect(await screen.findByText("semantic key required")).toBeInTheDocument();
  expect(screen.queryByText("Enter Shadow Mode")).not.toBeInTheDocument();
  rerender(
    <VersionDetail
      version={{ ...value, status: "VALIDATED" }}
      onRefresh={refresh}
    />,
  );
  await userEvent.click(screen.getByText("Enter Shadow Mode"));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
});
test("saving a hydrated draft sends only the supported DTO fields", async () => {
  api.saveApprovalPolicyVersion.mockResolvedValue({});
  const version = {
    id: 4,
    status: "DRAFT",
    version_number: 1,
    rules: [
      {
        id: 10,
        policy_version_id: 4,
        rule_code: "BASE",
        code: "BASE",
        name: "Base",
        priority: 1,
        is_active: true,
        isActive: true,
        stop_processing: false,
        stopProcessing: false,
        conditions: [{ type: "REQUEST_TYPE_EQUALS", value: "Stock" }],
        steps: [
          {
            stepOrder: 1,
            approvalLevel: 1,
            semanticKey: "REQUESTER",
            displayName: "Requester",
            resolverType: "REQUESTER",
            required: true,
          },
        ],
      },
    ],
  };

  render(<VersionDetail version={version} />);
  await userEvent.click(screen.getByRole("button", { name: /Save draft/i }));

  await waitFor(() => expect(api.saveApprovalPolicyVersion).toHaveBeenCalled());
  const savedRule = api.saveApprovalPolicyVersion.mock.calls[0][1].rules[0];
  expect(savedRule).toEqual({
    code: "BASE",
    name: "Base",
    description: "",
    priority: 1,
    isActive: true,
    stopProcessing: false,
    conditions: [{ type: "REQUEST_TYPE_EQUALS", value: "Stock" }],
    steps: [
      {
        stepOrder: 1,
        approvalLevel: 1,
        parallelGroup: "",
        semanticKey: "REQUESTER",
        displayName: "Requester",
        resolverType: "REQUESTER",
        resolverReference: "",
        required: true,
      },
    ],
  });
});
test("legacy resolver labels are normalized to canonical values when saved", async () => {
  api.saveApprovalPolicyVersion.mockResolvedValue({});
  const version = {
    id: 4,
    status: "DRAFT",
    version_number: 1,
    rules: [
      {
        code: "MEDICAL",
        name: "Medical Stock",
        priority: 1,
        conditions: [],
        steps: [
          {
            stepOrder: 1,
            approvalLevel: 1,
            semanticKey: "HOD",
            displayName: "HOD",
            resolverType: "DEPARTMENT HEAD",
            required: true,
          },
          {
            stepOrder: 2,
            approvalLevel: 2,
            semanticKey: "EXECUTIVE",
            displayName: "Executive",
            resolverType: "EXECUTIVE OWNER",
            required: true,
          },
          {
            stepOrder: 3,
            approvalLevel: 3,
            semanticKey: "SCM",
            displayName: "SCM",
            resolverType: "SUPPLY CHAIN AUTHORITY",
            required: true,
          },
        ],
      },
    ],
  };

  render(<VersionDetail version={version} />);

  expect(screen.getByLabelText("Step 1 resolver")).toHaveValue(
    "DEPARTMENT_HEAD",
  );
  expect(screen.getByLabelText("Step 2 resolver")).toHaveValue(
    "EXECUTIVE_OWNER",
  );
  expect(screen.getByLabelText("Step 3 resolver")).toHaveValue(
    "SUPPLY_CHAIN_AUTHORITY",
  );
  await userEvent.click(screen.getByRole("button", { name: /Save draft/i }));

  await waitFor(() => expect(api.saveApprovalPolicyVersion).toHaveBeenCalled());
  expect(
    api.saveApprovalPolicyVersion.mock.calls[0][1].rules[0].steps.map(
      ({ resolverType }) => resolverType,
    ),
  ).toEqual([
    "DEPARTMENT_HEAD",
    "EXECUTIVE_OWNER",
    "SUPPLY_CHAIN_AUTHORITY",
  ]);
});
test("an incomplete approval step is explained before the draft is submitted", async () => {
  render(
    <VersionDetail
      version={{
        id: 4,
        status: "DRAFT",
        version_number: 1,
        rules: [
          {
            code: "MEDICAL",
            name: "Medical Stock",
            priority: 1,
            conditions: [],
            steps: [
              {
                approvalLevel: 1,
                stepOrder: 1,
                semanticKey: "",
                displayName: "",
                resolverType: "DEPARTMENT_HEAD",
              },
            ],
          },
        ],
      }}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: /Save draft/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Routing rule 1, step 1: semantic key and display name are required.",
  );
  expect(api.saveApprovalPolicyVersion).not.toHaveBeenCalled();
});

test("new approval steps start with valid requester metadata", async () => {
  render(
    <VersionDetail
      version={{
        id: 4,
        status: "DRAFT",
        version_number: 1,
        rules: [{ code: "R", name: "Rule", priority: 1, steps: [] }],
      }}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: /Add step/i }));

  expect(screen.getByLabelText("Step 1 Semantic key")).toHaveValue("REQUESTER");
  expect(screen.getByLabelText("Step 1 Display name")).toHaveValue("Requester");
});
test("new rules receive the next available unique priority", async () => {
  render(
    <VersionDetail
      version={{
        id: 4,
        status: "DRAFT",
        version_number: 1,
        rules: [
          {
            code: "BASE",
            name: "Base",
            priority: 3,
            conditions: [],
            steps: [],
          },
        ],
      }}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: /Add rule/ }));
  expect(screen.getByLabelText("Rule 2 priority")).toHaveValue(4);
});
test("version readiness distinguishes structural validity from current routability", async () => {
  api.getApprovalPolicyVersionReadiness.mockResolvedValue({
    status: "WARNING",
    structurallyValid: true,
    currentlyRoutable: false,
    errors: [],
    warnings: [
      {
        code: "POSITION_VACANT",
        stepId: 14,
        message: "Medical Devices authority is currently vacant",
      },
    ],
  });
  render(
    <VersionDetail
      version={{ id: 4, status: "VALIDATED", version_number: 1, rules: [] }}
    />,
  );
  await userEvent.click(screen.getByText("Check routing readiness"));
  expect(
    await screen.findByText("Routing readiness: WARNING"),
  ).toBeInTheDocument();
  expect(screen.getByText("Structural validation: PASS")).toBeInTheDocument();
  expect(screen.getByText("Currently routable: NO")).toBeInTheDocument();
  expect(screen.getByText(/POSITION_VACANT/)).toBeInTheDocument();
});
test("shadow version is read-only and comparison renders all categories", () => {
  const { rerender } = render(
    <VersionDetail
      version={{ id: 4, status: "SHADOW", version_number: 1, rules: [] }}
    />,
  );
  expect(screen.getByText(/Read-only snapshot/)).toBeInTheDocument();
  rerender(
    <ShadowComparison
      run={{
        run_status: "UNRESOLVED",
        currentRoute: [{ approvalLevel: 1, userName: "Legacy" }],
        steps: [
          {
            approvalLevel: 1,
            semanticKey: "CEO",
            resolutionStatus: "AMBIGUOUS",
          },
        ],
        differences: [
          "MATCH",
          "ADDED_BY_SHADOW",
          "MISSING_IN_SHADOW",
          "DIFFERENT_USER",
          "UNRESOLVED_RESOLUTION",
          "AMBIGUOUS_RESOLUTION",
        ].map((type) => ({ type })),
      }}
    />,
  );
  expect(screen.getByText(/SHADOW ONLY/)).toBeInTheDocument();
  for (const label of [
    "MATCH",
    "ADDED_BY_SHADOW",
    "MISSING_IN_SHADOW",
    "DIFFERENT_USER",
    "UNRESOLVED_RESOLUTION",
    "AMBIGUOUS_RESOLUTION",
  ])
    expect(screen.getByText(label)).toBeInTheDocument();
});
test("POSITION and FIXED_USER render authenticated organization options while capability stays controlled", async () => {
  const base = {
    id: 4,
    status: "DRAFT",
    version_number: 1,
    rules: [
      {
        code: "R",
        name: "Rule",
        priority: 1,
        conditions: [],
        steps: [
          {
            approvalLevel: 1,
            stepOrder: 1,
            resolverType: "POSITION",
            resolverReference: "9:EXECUTIVE_HEAD",
            semanticKey: "EXEC",
            displayName: "Exec",
          },
          {
            approvalLevel: 2,
            stepOrder: 1,
            resolverType: "FIXED_USER",
            resolverReference: "17",
            semanticKey: "FIXED",
            displayName: "Fixed",
          },
          {
            approvalLevel: 3,
            stepOrder: 1,
            resolverType: "CAPABILITY_HOLDER",
            resolverReference: "approval-authority.ceo",
            semanticKey: "CAP",
            displayName: "Cap",
          },
        ],
      },
    ],
  };
  render(
    <VersionDetail
      version={base}
      options={{
        positions: [
          {
            id: 2,
            reference: "9:EXECUTIVE_HEAD",
            unit_name: "CEO Office",
            position_name: "CEO",
          },
        ],
        users: [{ id: 17, name: "Ada Admin" }],
      }}
    />,
  );
  expect(
    within(screen.getByLabelText("Position")).getByRole("option", {
      name: "CEO Office — CEO",
    }),
  ).toBeInTheDocument();
  expect(
    within(screen.getByLabelText("Institute user")).getByRole("option", {
      name: "Ada Admin",
    }),
  ).toBeInTheDocument();
  const capability = screen.getByLabelText("Capability");
  expect(
    within(capability).getByRole("option", { name: "Supply Chain authority" }),
  ).toBeInTheDocument();
  expect(within(capability).queryByText(/permission/i)).not.toBeInTheDocument();
});
test("condition values use organization and fixed-list dropdowns when available", async () => {
  const version = {
    id: 4,
    status: "DRAFT",
    version_number: 1,
    rules: [
      {
        code: "R",
        name: "Rule",
        priority: 1,
        conditions: [{ type: "DEPARTMENT_EQUALS", value: "" }],
        steps: [],
      },
    ],
  };
  render(
    <VersionDetail
      version={version}
      options={{
        departments: [{ id: 8, name: "Nursing" }],
        sections: [{ id: 12, name: "Ward A", department_name: "Nursing" }],
      }}
    />,
  );

  const value = screen.getByLabelText("Condition 1 value");
  expect(value.tagName).toBe("SELECT");
  expect(within(value).getByRole("option", { name: "Nursing" })).toHaveValue(
    "8",
  );

  await userEvent.selectOptions(
    screen.getByLabelText("Condition 1 type"),
    "SECTION_EQUALS",
  );
  expect(screen.getByLabelText("Condition 1 value")).toHaveValue("");
  expect(
    within(screen.getByLabelText("Condition 1 value")).getByRole("option", {
      name: "Nursing — Ward A",
    }),
  ).toHaveValue("12");

  await userEvent.selectOptions(
    screen.getByLabelText("Condition 1 type"),
    "AMOUNT_GTE",
  );
  expect(screen.getByLabelText("Condition 1 value").tagName).toBe("INPUT");
  expect(screen.getByLabelText("Condition 1 value")).toHaveAttribute(
    "inputmode",
    "decimal",
  );
});
test("dashboard uses policy-list shadow fields and institute departments, runs single and opens existing run", async () => {
  api.listApprovalPolicies.mockResolvedValue([
    {
      id: 1,
      name: "Standard",
      code: "STD",
      shadow_status: "SHADOW",
      shadow_version_id: 44,
      shadow_version_number: 3,
    },
  ]);
  getOrganizationOptions.mockResolvedValue({
    departments: [{ id: 8, name: "Nursing" }],
    users: [],
    positions: [],
  });
  api.listShadowRuns.mockResolvedValue([{ id: 70 }]);
  api.runApprovalPolicyShadow.mockResolvedValue({
    comparison: {
      result: "DIFFERENT",
      differences: [{ type: "DIFFERENT_USER" }],
    },
    currentRoute: [{ approvalLevel: 2, userName: "CMO" }],
    steps: [
      {
        approvalLevel: 2,
        userName: "CEO",
        semanticKey: "EXECUTIVE_AUTHORIZATION",
        resolutionStatus: "RESOLVED",
      },
    ],
  });
  api.getShadowRun.mockResolvedValue({
    id: 70,
    run_status: "MATCH",
    currentRoute: [],
    steps: [],
    differences: [{ difference_type: "MATCH" }],
  });
  render(<ApprovalPoliciesPage />);
  await screen.findByText("Standard");
  await userEvent.click(screen.getByText("Shadow validation dashboard"));
  expect(
    within(screen.getByLabelText("Shadow policy version")).getByRole("option", {
      name: "Standard — Version 3",
    }),
  ).toHaveValue("44");
  expect(
    within(screen.getByLabelText("Shadow department")).getByRole("option", {
      name: "Nursing",
    }),
  ).toHaveValue("8");
  await userEvent.selectOptions(
    screen.getByLabelText("Shadow policy version"),
    "44",
  );
  await userEvent.type(screen.getByLabelText("Request ID"), "123");
  await userEvent.click(screen.getByText("Run Shadow"));
  expect(await screen.findByText("DIFFERENT_USER")).toBeInTheDocument();
  expect(api.runApprovalPolicyShadow).toHaveBeenCalledWith("44", "123");
  await userEvent.click(screen.getByText("Open shadow run 70"));
  await waitFor(() => expect(api.getShadowRun).toHaveBeenCalledWith(70));
  expect(await screen.findByText("MATCH")).toBeInTheDocument();
});
test("batch results drill down to a rendered comparison", async () => {
  api.listApprovalPolicies.mockResolvedValue([
    {
      id: 1,
      name: "Standard",
      code: "STD",
      shadow_version_id: 44,
      shadow_version_number: 3,
    },
  ]);
  api.runApprovalPolicyShadowBatch.mockResolvedValue({
    evaluated: 1,
    different: 1,
    runs: [{ id: 91 }],
  });
  api.getShadowRun.mockResolvedValue({
    id: 91,
    run_status: "DIFFERENT",
    currentRoute: [{ approvalLevel: 2, userName: "CMO" }],
    steps: [
      { approvalLevel: 2, userName: "CEO", resolution_status: "RESOLVED" },
    ],
    differences: [{ difference_type: "DIFFERENT_USER" }],
  });
  render(<ApprovalPoliciesPage />);
  await screen.findByText("Standard");
  await userEvent.click(screen.getByText("Shadow validation dashboard"));
  await userEvent.selectOptions(
    screen.getByLabelText("Shadow policy version"),
    "44",
  );
  await userEvent.click(screen.getByText("Run shadow analysis"));
  expect(await screen.findByText("Evaluated:")).toBeInTheDocument();
  await userEvent.click(screen.getByText("Open generated run 91"));
  expect(await screen.findByText("CURRENT APPROVAL ROUTE")).toBeInTheDocument();
  expect(screen.getByText("POLICY SHADOW ROUTE")).toBeInTheDocument();
  expect(screen.getByText("DIFFERENT_USER")).toBeInTheDocument();
});
