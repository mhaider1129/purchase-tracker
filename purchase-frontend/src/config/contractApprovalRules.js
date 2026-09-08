export const defaultContractApprovalRules = {
  maxDraftEditRounds: 3,
  editGateRoles: ['contract_manager', 'scm', 'coo'],
  stages: [
    {
      key: 'main_technical_review',
      label: 'Main Technical HOD',
      description: 'The HOD of the main technical department reviews the complete draft first.',
      roleType: 'technical_department_representative',
      canSuggestEdits: true,
    },
    {
      key: 'finance_approval',
      label: 'Finance Approval (parallel)',
      roleType: 'cfo',
      parallelGroup: 'legal_finance',
      canSuggestEdits: true,
    },
    {
      key: 'legal_approval',
      label: 'Legal Approval (parallel)',
      description: 'Legal can approve or suggest edits for specific contract sections.',
      roleType: 'legal',
      parallelGroup: 'legal_finance',
      canSuggestEdits: true,
    },
    {
      key: 'secondary_technical_review',
      label: 'Secondary Technical Review',
      description: 'Each secondary department reviews only the sections assigned to it.',
      roleType: 'technical_department_representative',
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