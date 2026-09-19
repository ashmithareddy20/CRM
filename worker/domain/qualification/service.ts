import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../../../db";
import { operationalTasks, qualificationAnswers, qualificationScores, questionnaires, scoreComponents, scorePolicies } from "../../../db/schema";
import type { QualificationAnswers } from "../../../lib/api/leads";
import { ApiError } from "../../api/errors";

export interface QualificationContext { tenantId: string; actorMembershipId: string; now: Date; }
export interface QualificationResult { scoreId: string; classification: "hot" | "warm" | "cold" | "incomplete"; total: number; policyId: string; clinicalEscalation: boolean; }
interface ScoreRule { points?: Record<string, number>; hotAt?: number; warmAt?: number; required?: string[]; }
const id = () => crypto.randomUUID();

/** Pure, explainable rules-based assessment. Missing required answers are incomplete, never Cold. */
export class QualificationService {
  constructor(private readonly db: Database, private readonly protect: { encrypt(tenantId: string, recordId: string, purpose: string, value: string): Promise<string> }) {}

  async assess(context: QualificationContext, leadId: string, questionnaireId: string, answers: QualificationAnswers, requestedPolicyId?: string, override?: { classification: "hot" | "warm" | "cold"; reason: string }): Promise<QualificationResult> {
    const encryptedAnswers = await Promise.all(Object.entries(answers).map(async ([questionKey, answer]) => {
      const answerId = id();
      return [answerId, questionKey, await this.protect.encrypt(context.tenantId, answerId, "qualification-answer", JSON.stringify(answer))] as const;
    }));
    const questionnaire = await this.db.select().from(questionnaires).where(and(eq(questionnaires.tenantId, context.tenantId), eq(questionnaires.id, questionnaireId))).get();
    if (!questionnaire) throw new ApiError("NOT_FOUND", 404, "Questionnaire is unavailable");
    const policy = requestedPolicyId
      ? await this.db.select().from(scorePolicies).where(and(eq(scorePolicies.tenantId, context.tenantId), eq(scorePolicies.id, requestedPolicyId))).get()
      : await this.db.select().from(scorePolicies).where(and(eq(scorePolicies.tenantId, context.tenantId), eq(scorePolicies.key, questionnaire.key))).orderBy(desc(scorePolicies.effectiveAt)).get();
    if (!policy) throw new ApiError("NOT_FOUND", 404, "Score policy is unavailable");
    const rules = parsePolicy(policy.rulesJson);
    const components = Object.entries(answers).map(([component, answer]) => ({ component, answer: String(answer), points: rules.points?.[`${component}.${answer}`] ?? 0 }));
    const missing = (rules.required ?? ["symptomSeverity", "urgency", "financialReadiness", "appointmentReadiness", "consultationInterest"]).filter((key) => !(key in answers));
    const total = components.reduce((sum, component) => sum + component.points, 0);
    const baseClassification: QualificationResult["classification"] = missing.length ? "incomplete" : total >= (rules.hotAt ?? 18) ? "hot" : total >= (rules.warmAt ?? 9) ? "warm" : "cold";
    const classification = override ? override.classification : baseClassification;
    const scoreId = id();
    const evidence = { policyVersion: policy.versionLabel, questionnaireVersion: questionnaire.versionLabel, answersPresent: Object.keys(answers), missing, computedClassification: baseClassification, overridden: Boolean(override) };
    const clinicalEscalation = answers.urgency === "urgent" || answers.urgency === "emergency";

    const statements = [
      ...encryptedAnswers.map(([answerId, questionKey, answerCiphertext]) => this.db.insert(qualificationAnswers).values({ id: answerId, tenantId: context.tenantId, leadId, questionnaireId, questionKey, answerCiphertext, answeredAt: context.now, createdAt: context.now, createdByMembershipId: context.actorMembershipId }).onConflictDoUpdate({ target: [qualificationAnswers.tenantId, qualificationAnswers.leadId, qualificationAnswers.questionnaireId, qualificationAnswers.questionKey], set: { answerCiphertext, answeredAt: context.now, updatedAt: context.now, updatedByMembershipId: context.actorMembershipId } })), 
      this.db.insert(qualificationScores).values({ id: scoreId, tenantId: context.tenantId, leadId, policyId: policy.id, classification, total, evidenceJson: JSON.stringify(evidence), assessedAt: context.now, reviewedByMembershipId: override ? context.actorMembershipId : null, overrideReason: override?.reason ?? null, createdAt: context.now, createdByMembershipId: context.actorMembershipId }),
      ...components.map((component) => this.db.insert(scoreComponents).values({ id: id(), tenantId: context.tenantId, scoreId, component: component.component, points: component.points, evidenceJson: JSON.stringify({ answer: component.answer }), createdAt: context.now, createdByMembershipId: context.actorMembershipId })),
      ...(clinicalEscalation ? [this.db.insert(operationalTasks).values({ id: id(), tenantId: context.tenantId, leadId, title: "Clinical urgency review required", dueAt: context.now, priority: "urgent", createdAt: context.now, createdByMembershipId: context.actorMembershipId })] : []),
    ];
    await this.db.batch(statements as [typeof statements[number], ...typeof statements[number][]]);
    return { scoreId, classification, total, policyId: policy.id, clinicalEscalation };
  }
}
function parsePolicy(value: string): ScoreRule { try { return JSON.parse(value) as ScoreRule; } catch { return {}; } }
