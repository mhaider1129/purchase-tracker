# Purchase Tracker — Codex Instructions

## Repository

This repository contains the WICI Purchase Tracker / Supply Chain Management system.

Main applications:

- `purchase-backend` — Node.js / Express backend
- `purchase-frontend` — React frontend
- PostgreSQL / Supabase — production database

The primary Git branch is:

`master`

---

## General Working Rules

When implementing a task:

1. Inspect the existing implementation before modifying code.
2. Follow the existing architecture and conventions.
3. Prefer modifying existing services/modules over duplicating functionality.
4. Do not introduce unnecessary dependencies.
5. Preserve backward compatibility unless the task explicitly requires otherwise.
6. Check frontend/backend integration when changing APIs.
7. Check authorization and role permissions when changing protected functionality.
8. Check audit logging when changing business workflows.
9. Add or update automated tests for meaningful behavioral changes.
10. Run the relevant test suites before considering the task complete.

Do not silently ignore failing tests.

If an unrelated pre-existing test fails, report it clearly.

---

# Database Safety

The production database is Supabase/PostgreSQL.

Codex MUST NOT:

- connect to the production database;
- execute SQL against production;
- run migrations against production;
- modify production Supabase data;
- reset the database;
- automatically apply schema changes.

Database migrations are applied manually by the repository owner through the Supabase SQL Editor.

When a database change is required:

1. Create a migration/SQL patch in the repository.
2. Make the migration safe for the existing production database.
3. Prefer idempotent SQL where practical.
4. Do not assume a clean database.
5. Do not automatically execute the migration against production.
6. Clearly identify the migration in the final task summary.

The final response must explicitly say:

`MANUAL DATABASE MIGRATION REQUIRED`

when applicable and provide the exact migration file that must be applied.

---

# Existing Production Data

Assume the system contains important live hospital procurement data.

Never design migrations that unnecessarily:

- DROP populated tables;
- truncate production data;
- recreate tables when ALTER TABLE is sufficient;
- overwrite existing records;
- reset sequences;
- remove columns without explicit authorization.

Schema changes should preserve existing data.

---

# Git Workflow

For each implementation task, work on a dedicated branch.

Preferred branch naming:

`codex/<short-task-description>`

Do not make implementation commits directly to `master`.

After implementation:

1. Review the complete diff.
2. Run relevant backend tests.
3. Run relevant frontend tests when frontend code changed.
4. Run build/lint/type checks where applicable.
5. Fix failures caused by the implementation.
6. Commit the completed changes.
7. Publish/push the branch to GitHub when repository permissions allow.
8. Create a Draft Pull Request targeting:

`master`

Do NOT merge the Pull Request.

The repository owner will review and merge the PR manually.

If the environment cannot create or publish a PR, prepare the branch and commit and clearly explain what action remains.

---

# Pull Request Requirements

Draft PR titles should clearly describe the change.

The PR description should contain:

## Summary

Explain what was changed and why.

## Major Changes

Describe important backend, frontend, database, workflow, or architectural changes.

## Testing

List tests/checks that were executed and their results.

## Database Changes

State either:

`No database migration required.`

or:

`MANUAL DATABASE MIGRATION REQUIRED`

and list the migration files.

## Deployment Notes

Describe any required deployment/configuration steps.

## Risks / Follow-up

Identify known risks, limitations, technical debt, or recommended follow-up work.

---

# Backend

Before changing backend behavior, inspect relevant:

- routes;
- controllers;
- services;
- middleware;
- authorization;
- database queries;
- audit logging;
- tests.

Business logic should preferably live in services rather than route handlers.

Avoid duplicating business logic across modules.

When changing an API contract, inspect frontend consumers of that API.

---

# Frontend

When modifying frontend functionality:

- use the repository's canonical Axios/API client;
- do not introduce independent Axios configurations without a strong reason;
- preserve authentication behavior;
- preserve centralized 401 handling;
- preserve notification/error handling;
- check role-based visibility;
- check loading and error states.

Avoid hard-coded backend URLs.

---

# Authorization

This is a hospital supply-chain system with role-based access control.

Never weaken authorization merely to make functionality work.

For new or modified endpoints:

1. determine which roles should have access;
2. enforce authorization server-side;
3. treat frontend role checks as UI behavior, not security;
4. test unauthorized access where appropriate.

---

# Auditability

Important supply-chain actions should remain auditable.

When introducing or modifying actions involving:

- approvals;
- procurement;
- purchase requests;
- contracts;
- inventory;
- fixed assets;
- finance;
- invoices;
- payments;
- assignments;
- status transitions;

check whether an audit-log entry is required.

---

# Financial and Procurement Integrity

Changes affecting financial or procurement workflows require extra care.

Do not bypass:

- approval chains;
- segregation of duties;
- invoice controls;
- payment controls;
- matching controls;
- authorization rules;

simply to make a workflow succeed.

Prefer explicit validation failures over silently accepting inconsistent financial data.

---

# Completion Criteria

A task is not complete merely because code was generated.

Before completion:

- review the diff;
- verify imports and references;
- run relevant tests;
- run appropriate build checks;
- inspect changed API contracts;
- inspect authorization implications;
- inspect database implications;
- check for obvious regressions.

Do not claim tests passed unless they were actually executed.

---

# Final Codex Response

At the end of every implementation task, provide:

### Implementation
What was implemented.

### Files Changed
Important files/modules changed.

### Tests
Commands executed and results.

### Database
Whether a manual migration is required.

### Git
Branch name, commit, and Draft PR status/link.

### Deployment
Any manual steps required after merging.

### Remaining Issues
Anything that could not be completed or verified.

Never claim that a branch was pushed or a PR was created unless it actually happened.