export const defaultContractApprovalRules = {
  maxDraftEditRounds: 3,
  editGateRoles: ['contract_manager', 'scm', 'coo'],
  stages: [
    {
      key: 'technical_review',
      label: 'Technical Review',
      description: 'A user from each technical department selected during contract creation.',
      roleType: 'technical_department_representative',
      canSuggestEdits: true,
    },
    {
      key: 'cfo_approval',
      label: 'CFO Approval',
      roleType: 'cfo',
      canSuggestEdits: true,
    },
    {
      key: 'legal_approval',
      label: 'Legal Approval',
      description: 'Legal can approve or suggest edits for specific contract sections.',
      roleType: 'legal',
      canSuggestEdits: true,
    },
    {
      key: 'scm_approval',
      label: 'SCM Approval',
      roleType: 'scm',
      canSuggestEdits: true,
    },
    {
      key: 'coo_approval',
      label: 'COO Approval',
      roleType: 'coo',
      canSuggestEdits: true,
    },
  ],
};

export const contractSectionCatalog = [
  'Scope of Work',
  'Technical Specifications',
  'Payment Terms',
  'Delivery Terms',
  'SLA & Performance',
  'Risk & Dispute Management',
  'Legal Clauses',
  'Termination & Exit Terms',
];