/**
 * Transparent workforce task-triage rules.
 * This is a deterministic planning aid, not a model-generated feasibility guarantee.
 * It never executes work, accesses business systems, or makes employment decisions.
 */
export type TaskRisk = "low" | "medium" | "high";
export type WorkforceRecommendation = "automate_candidate" | "human_led" | "hybrid";

export interface WorkforceTaskInput {
  task: string;
  industry?: string;
  frequency?: "once" | "daily" | "weekly" | "monthly";
  dataSensitivity?: "public" | "internal" | "confidential" | "regulated";
  errorImpact?: "low" | "medium" | "high";
  requiresPhysicalPresence?: boolean;
  requiresLicensedJudgment?: boolean;
  requiresEmpathyOrNegotiation?: boolean;
}

export interface WorkforceTaskAssessment {
  recommendation: WorkforceRecommendation;
  confidence: "limited";
  risk: TaskRisk;
  summary: string;
  suitableForAutomation: string[];
  humanResponsibilities: string[];
  prerequisites: string[];
  validationGates: string[];
  nextSteps: string[];
  limitations: string[];
}

const clampText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export function assessWorkforceTask(input: WorkforceTaskInput): WorkforceTaskAssessment {
  const task = clampText(input.task, 3000);
  const frequency = ["once", "daily", "weekly", "monthly"].includes(input.frequency ?? "") ? input.frequency! : "once";
  const sensitivity = ["public", "internal", "confidential", "regulated"].includes(input.dataSensitivity ?? "") ? input.dataSensitivity! : "internal";
  const impact = ["low", "medium", "high"].includes(input.errorImpact ?? "") ? input.errorImpact! : "medium";
  const normalized = task.toLowerCase();
  const signals = {
    repetitive: /report|summari[sz]|classif|categor|extract|transcrib|schedule|invoice|data entry|routine|reconcil|format|monitor|draft|respond to common|faq/.test(normalized),
    decisionHeavy: /diagnos|prescrib|legal advice|approve|fire|hire|disciplin|invest|trade|safety-critical|emergency|surgery|treatment/.test(normalized),
    peopleFacing: Boolean(input.requiresEmpathyOrNegotiation) || /negotia|conflict|complaint|counsel|therapy|caregiving|customer escalation|relationship|interview/.test(normalized),
    physical: Boolean(input.requiresPhysicalPresence) || /repair|install|drive|deliver|clean|operate machinery|physical inspection|hands-on/.test(normalized),
    licensed: Boolean(input.requiresLicensedJudgment) || /licensed|certified professional|medical|clinical|legal judgment|engineering sign.?off/.test(normalized),
  };
  const sensitive = sensitivity === "regulated" || sensitivity === "confidential";
  const highRisk = impact === "high" || signals.decisionHeavy || signals.licensed || sensitivity === "regulated" || sensitivity === "confidential";
  const prerequisites = [
    "Connect only the approved systems and data sources required for this task; none are connected by this assessment.",
    "Define an accountable owner, allowed actions, access permissions, and a way to stop or reverse changes.",
    "Use representative test cases and a human-approved baseline before any production rollout.",
  ];
  if (sensitive) prerequisites.unshift("Confirm the lawful basis, data minimization, access controls, retention policy, and any applicable sector or cross-border rules.");
  if (signals.physical) prerequisites.push("Provide a qualified person for physical-world work; software alone cannot perform the physical task.");
  if (signals.licensed) prerequisites.push("Require an appropriately licensed professional to make and sign off regulated judgments.");
  if (signals.peopleFacing) prerequisites.push("Set escalation rules for nuanced, vulnerable, disputed, or emotionally sensitive interactions.");

  const recommendation: WorkforceRecommendation =
    signals.physical || signals.licensed || (signals.decisionHeavy && impact !== "low")
      ? "human_led"
      : signals.repetitive && !highRisk
        ? "automate_candidate"
        : "hybrid";

  const suitableForAutomation = signals.repetitive
    ? ["Prepare drafts, summaries, classifications, or structured records for review.", "Run repeatable checks and flag exceptions using approved rules."]
    : ["Explore bounded assistance such as information retrieval, first drafts, checklists, or routing—not unsupervised final decisions."];
  const humanResponsibilities = [
    "Own the outcome and review exceptions or low-confidence cases.",
    "Approve consequential external communications, payments, access changes, and irreversible actions.",
  ];
  if (signals.licensed || signals.physical) humanResponsibilities.unshift("Perform or sign off the physical, licensed, or safety-critical part of the work.");
  if (signals.peopleFacing) humanResponsibilities.push("Handle escalations that require judgment, empathy, negotiation, or accountability.");
  if (highRisk) humanResponsibilities.push("Retain final authority; do not deploy unattended automation for consequential decisions.");
  const validationGates = [
    "Measure task accuracy and completion against a documented human baseline.",
    "Test edge cases, failure handling, permission boundaries, and prompt/data-injection risks.",
    "Use a limited pilot with monitoring, an audit trail, and a tested rollback/disable switch.",
  ];
  if (sensitive) validationGates.unshift("Obtain security/privacy review and verify the minimum necessary data is used.");
  if (impact === "high") validationGates.push("Require explicit human approval before production actions and establish incident escalation.");
  const nextSteps = recommendation === "automate_candidate"
    ? ["Map the current process and define a measurable success criterion.", "Identify the exact tools/APIs and permissions needed.", "Prototype in a sandbox, compare with the baseline, then seek human approval for a controlled pilot."]
    : recommendation === "human_led"
      ? ["Keep a qualified human accountable for the core task.", "Identify small administrative subtasks that could be safely assisted by AI.", "Document required credentials, supervision, and escalation procedures."]
      : ["Split the workflow into automatable subtasks and human-owned decisions.", "Assign explicit handoff points and exception queues.", "Pilot one low-risk segment before expanding scope."];
  const risk: TaskRisk = highRisk || sensitive ? "high" : signals.peopleFacing || impact === "medium" ? "medium" : "low";

  return {
    recommendation,
    confidence: "limited",
    risk,
    summary: recommendation === "automate_candidate"
      ? "This task may be a candidate for bounded automation, subject to integration, permission, and measured-quality checks."
      : recommendation === "human_led"
        ? "Keep a qualified person responsible for the core task. AI may assist with preparation or administration but should not replace required human judgment."
        : "A hybrid workflow is the prudent starting point: automate bounded support tasks and retain human ownership of decisions and exceptions.",
    suitableForAutomation,
    humanResponsibilities,
    prerequisites: [...new Set(prerequisites)],
    validationGates,
    nextSteps,
    limitations: [
      "This is a rule-based first-pass assessment, not a live AI capability test or a guarantee that a task can be automated.",
      "No integrations were checked, no company data was accessed, and no work was executed.",
      "Time savings, cost savings, accuracy, and ROI have not been measured or predicted.",
      `Frequency supplied: ${frequency}; industry supplied: ${clampText(input.industry, 120) || "not specified"}.`,
    ],
  };
}
