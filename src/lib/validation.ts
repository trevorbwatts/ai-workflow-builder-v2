import { ApprovalWorkflow, ValidationIssue, WorkflowRule } from '../types';

function validateRule(rule: WorkflowRule): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check: template placeholders match node keys
  const placeholders = (rule.template.match(/\{([^{}]+)\}/g) ?? []).map((p) => p.slice(1, -1).trim());
  for (const ph of placeholders) {
    if (!rule.nodes[ph]) {
      issues.push({
        ruleId: rule.id,
        kind: 'empty_rule',
        severity: 'error',
        message: `Template references "{${ph}}" but no matching node exists in rule "${rule.label}".`,
        nodeId: ph,
      });
    }
  }

  // Check: at least one approver node
  const hasApprover = Object.values(rule.nodes).some((n) => n.type === 'approvers');
  if (!hasApprover) {
    issues.push({
      ruleId: rule.id,
      kind: 'missing_approver',
      severity: 'error',
      message: `Rule "${rule.label}" has no approver. Every rule needs at least one approver.`,
    });
  }

  // Check: timeout without escalation
  const hasTimeout = Object.values(rule.nodes).some((n) => n.type === 'timeout');
  if (hasTimeout) {
    // Look for an approver node that comes after the timeout in the template
    const timeoutIdx = placeholders.findIndex((ph) => rule.nodes[ph]?.type === 'timeout');
    const escalationAfter = placeholders.slice(timeoutIdx + 1).some((ph) => rule.nodes[ph]?.type === 'approvers');
    if (!escalationAfter) {
      issues.push({
        ruleId: rule.id,
        kind: 'missing_escalation',
        severity: 'warning',
        message: `Rule "${rule.label}" has a timeout but no escalation approver after it.`,
      });
    }
  }

  // Check: empty template
  if (!rule.template.trim()) {
    issues.push({
      ruleId: rule.id,
      kind: 'empty_rule',
      severity: 'error',
      message: `Rule "${rule.label}" has an empty template.`,
    });
  }

  return issues;
}

export function validateWorkflow(workflow: ApprovalWorkflow): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const rules = workflow.pendingDraft?.rules ?? workflow.rules;
  const defaultRuleId = workflow.pendingDraft?.defaultRuleId ?? workflow.defaultRuleId;

  // Check: default rule exists
  const defaultRule = rules.find((r) => r.id === defaultRuleId);
  if (!defaultRule) {
    issues.push({
      kind: 'gap',
      severity: 'error',
      message: 'No default (catch-all) rule found. Some employees may not be covered.',
    });
  }

  // Check: duplicate filters
  const filterKeys = new Set<string>();
  for (const rule of rules) {
    if (!rule.filter) continue;
    const key = rule.filter.conditions
      .map((c) => `${c.attribute}:${c.operator}:${c.value}`)
      .sort()
      .join('|');
    if (filterKeys.has(key)) {
      issues.push({
        ruleId: rule.id,
        kind: 'redundancy',
        severity: 'warning',
        message: `Rule "${rule.label}" has the same conditions as another rule.`,
      });
    }
    filterKeys.add(key);
  }

  // Validate each rule
  for (const rule of rules) {
    issues.push(...validateRule(rule));
  }

  return issues;
}
