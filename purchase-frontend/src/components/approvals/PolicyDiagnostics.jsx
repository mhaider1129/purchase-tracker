import React from 'react';

export function SemanticPurpose({ value }) {
  if (!value || value === 'LEGACY_SEMANTIC_UNKNOWN')
    return (
      <span
        className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600"
        title="This approval was created by the legacy routing engine, which did not store Approval Engine 2.0 semantic-purpose metadata."
      >
        Legacy approval — purpose unavailable
      </span>
    );
  return <span>{value}</span>;
}

const format = (value) =>
  value == null
    ? 'Unavailable'
    : typeof value === 'boolean'
      ? value
        ? 'Yes'
        : 'No'
      : typeof value === 'string' || Array.isArray(value)
        ? JSON.stringify(value)
        : String(value);
export default function PolicyDiagnostics({ diagnostics, policy }) {
  return (
    <section
      className="mt-4 rounded-xl border border-slate-200 bg-white p-4"
      aria-label="Rule matching diagnostics"
    >
      <h3 className="font-semibold">Rule matching diagnostics</h3>
      {policy && (
        <p className="mt-2 text-sm text-slate-600">
          Evaluated policy: {policy.name || policy.code || policy.id} · Version{' '}
          {policy.versionNumber ?? 'unavailable'} (ID{' '}
          {policy.versionId ?? 'unavailable'}) · {policy.status} ·{' '}
          {policy.activeRuleCount ?? 'unavailable'} active /{' '}
          {policy.ruleCount ?? 'unavailable'} total rules
        </p>
      )}
      {!diagnostics ? (
        <p className="mt-2 text-sm text-slate-500">
          Condition diagnostics were not recorded for this historical run.
          Generate a new shadow run to inspect the selected version.
        </p>
      ) : diagnostics.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          The evaluated version has no active rules. Verify the selected policy
          and version configuration.
        </p>
      ) : (
        diagnostics.map((rule, index) => (
          <article
            key={`${rule.code}-${index}`}
            className="mt-3 rounded border border-slate-200 p-3"
          >
            <h4 className="font-semibold">
              {rule.code} · {rule.result}
            </h4>
            <p className="text-xs text-slate-600">
              Priority {rule.priority} ·{' '}
              {rule.selected
                ? 'Selected for shadow route'
                : rule.skippedBy
                  ? `Not selected: processing stopped by ${rule.skippedBy}`
                  : 'Not selected'}
            </p>
            {rule.conditions.length === 0 && (
              <p className="text-sm">
                No conditions configured; this rule matches all facts.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="mt-2 w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="p-2">Condition</th>
                    <th className="p-2">Expected</th>
                    <th className="p-2">Actual</th>
                    <th className="p-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {rule.conditions.map((condition, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">
                        {condition.type}
                        <p className="text-xs text-slate-500">
                          Stored value: {format(condition.configuredValue)}
                        </p>
                        {condition.reason && (
                          <p className="text-xs text-slate-500">
                            {condition.reason}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-pre-wrap break-all p-2">
                        <code>{format(condition.expected)}</code>
                      </td>
                      <td className="whitespace-pre-wrap break-all p-2">
                        <code>{format(condition.actual)}</code>
                      </td>
                      <td className="p-2">
                        <span
                          className={
                            condition.result === 'UNKNOWN'
                              ? 'text-slate-600'
                              : condition.result === 'PASS'
                                ? 'text-emerald-700'
                                : 'text-amber-800'
                          }
                        >
                          {condition.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))
      )}
      <p className="mt-3 text-xs text-slate-500">
        Diagnostic only. Request types and other equality operands compare exact
        stored strings, including case and spacing. Medical/Operational
        classification case variants are equivalent. UNKNOWN means a required
        fact was unavailable. These results do not change live approvals.
      </p>
    </section>
  );
}
