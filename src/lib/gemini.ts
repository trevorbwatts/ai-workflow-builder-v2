import { Workflow } from "../types";
import { NODE_LIBRARY_DESCRIPTION, displayScopeValue } from "./nodes";
import { ScopeValue } from "../types";

export async function processWorkflowEdit(
  currentWorkflow: Workflow,
  userMessage: string,
  history: { role: 'user' | 'model'; content: string }[]
): Promise<{ updatedWorkflow: Workflow; explanation: string }> {
  const system = `
You are an expert HR Workflow Architect for BambooHR. You help HR administrators customize their approval workflows using plain language.

A workflow has:
- A "template" string with {nodeId} placeholders that form a readable sentence
- A "nodes" map where each key matches a placeholder in the template
- The first node is always a "scope" node ({scope}) that defines who this workflow applies to

${NODE_LIBRARY_DESCRIPTION}

Current workflow state:
${JSON.stringify(currentWorkflow, null, 2)}

When the user asks to change something, you may:
1. Update the value of an existing node
2. Add new nodes — add entries to "nodes" AND update "template" to include the new {nodeId} placeholders with natural surrounding text
3. Remove nodes — remove from "nodes" AND remove the placeholder and its surrounding clause from "template"

Rules:
- Every {placeholder} in the template MUST have a matching key in "nodes"
- The {scope} node must always remain first in the template
- Node IDs must be lowercase_with_underscores
- Template text must read as a natural, complete sentence
- Be concise in your explanation (1-2 sentences)
- NEVER use {placeholder} syntax in your explanation text
- Respond ONLY with valid JSON matching this exact shape:
  {"updatedWorkflow": <Workflow object>, "explanation": "<string>"}
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

  if (!res.ok) throw new Error(await res.text());
  const result = await res.json();

  if (result.updatedWorkflow?.nodes) {
    const normalized: Record<string, any> = {};
    Object.entries(result.updatedWorkflow.nodes).forEach(([key, node]: [string, any]) => {
      if (node) normalized[key] = { ...node, id: node.id || key };
    });
    result.updatedWorkflow.nodes = normalized;
  }

  return result;
}

export async function suggestScopeAdjustments(
  variants: Array<{ id: string; scope: ScopeValue }>,
  workflowName: string
): Promise<Array<{ variantId: string; suggestedAttribute: string; suggestedValue: string; suggestedDisplay: string }>> {
  if (variants.length < 2) return [];

  const scopeSummary = variants
    .map((v) => `- id: "${v.id}", scope: "${displayScopeValue(v.scope)}"`)
    .join('\n');

  const prompt = `
You are reviewing ${workflowName} workflow variants for scope conflicts.

Current variants:
${scopeSummary}

Identify any conflicts (e.g. "all employees" overlapping with specific groups) and suggest scope adjustments so each variant is mutually exclusive. Only suggest changes where necessary. For a catch-all that overlaps with specific scopes, suggest changing it to "all other employees" by returning attribute: "all_other" and value: "".

Respond ONLY with a valid JSON array of suggestions (only include variants that need changes):
[{"variantId": "...", "suggestedAttribute": "...", "suggestedValue": "...", "suggestedDisplay": "..."}]
`;

  try {
    const res = await fetch('/api/scope-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
