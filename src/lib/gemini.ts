import { ApprovalWorkflow, Message, ValidationIssue } from "../types";
import { NODE_LIBRARY_DESCRIPTION } from "./nodes";

export async function processWorkflowEdit(
  currentWorkflow: ApprovalWorkflow,
  activeRuleId: string,
  userMessage: string,
  history: Message[]
): Promise<{ updatedWorkflow: ApprovalWorkflow; explanation: string; validationIssues: ValidationIssue[] }> {
  const activeRule = currentWorkflow.rules.find((r) => r.id === activeRuleId);
  const activeLabel = activeRule?.label ?? 'Unknown';

  const system = `
You are an expert HR Workflow Architect for BambooHR. You help HR administrators customize their approval workflows using plain language.

An ApprovalWorkflow contains multiple "rules". Each rule defines:
- A "filter" (condition) determining which employees it applies to. null = catch-all (all employees).
  Filter shape: { logic: "AND" | "OR", conditions: [{ attribute: "department" | "location_country" | "location_state" | "division" | "employment_status" | "person", operator: "is" | "is_not", value: string }] }
- A "label" — human-readable name for this rule (e.g., "Engineering Department", "Default")
- A "template" string with {nodeId} placeholders forming readable sentences
- A "nodes" map where each key matches a placeholder in the template

The user is currently editing rule: "${activeRuleId}" ("${activeLabel}")

${NODE_LIBRARY_DESCRIPTION}

Current workflow state:
${JSON.stringify(currentWorkflow, null, 2)}

You may:
1. Modify the active rule's nodes and template
2. Add new rules or modify other rules if the user requests (e.g., "add a rule for Sales department")
3. Change a rule's filter conditions
4. Remove rules (but never remove the last rule or the default rule)

Rules:
- Every {placeholder} in each rule's template MUST have a matching key in that rule's "nodes"
- Do NOT include scope nodes — scope is handled by the rule's "filter" property
- Node IDs must be lowercase_with_underscores
- Template text must read as natural, complete sentences
- Escalation rules (timeout + escalation, or status_condition + backup) MUST appear as their own sentence at the END of the template
- Be concise in your explanation (1-2 sentences)
- NEVER use {placeholder} syntax in your explanation text

After making changes, validate the workflow for issues:
- Check if all employees are covered (is there a default/catch-all rule with filter: null?)
- Check if any rule is missing approvers
- Check if timeout nodes have corresponding escalation

Respond ONLY with valid JSON matching this exact shape:
{"updatedWorkflow": <full ApprovalWorkflow object>, "explanation": "<string>", "validationIssues": [{"ruleId": "<optional>", "kind": "<gap|redundancy|missing_escalation|missing_approver|empty_rule>", "severity": "<error|warning>", "message": "<string>", "nodeId": "<optional>"}]}
If there are no issues, return an empty array for validationIssues.
`;

  const messages = [
    ...history.map((h) => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const res = await fetch('/api/workflow-edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages }),
  });

  if (!res.ok) throw new Error(`Server error ${res.status}: ${await res.text()}`);
  const result = await res.json();

  if (result.error) throw new Error(result.error);
  if (!result.updatedWorkflow) throw new Error('No updatedWorkflow in response');

  // Normalize nodes in all rules
  if (result.updatedWorkflow?.rules) {
    for (const rule of result.updatedWorkflow.rules) {
      if (rule.nodes) {
        const normalized: Record<string, any> = {};
        Object.entries(rule.nodes).forEach(([key, node]: [string, any]) => {
          if (node) normalized[key] = { ...node, id: node.id || key };
        });
        rule.nodes = normalized;
      }
    }
  }

  return {
    updatedWorkflow: result.updatedWorkflow,
    explanation: result.explanation ?? '',
    validationIssues: result.validationIssues ?? [],
  };
}
