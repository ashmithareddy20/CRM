/** Evidence-backed conversion rules. A booking, quote, or UI label never constitutes conversion. */
export type ClinicalCompletion = "medical_management_completed" | "procedure_completed" | "treatment_completed";
export interface ConversionEvidence {
  leadId: string;
  completion: ClinicalCompletion;
  completedAt: Date;
  evidenceId: string;
}

export function isEligibleConversion(evidence: Pick<ConversionEvidence, "completion" | "evidenceId">): boolean {
  return Boolean(evidence.evidenceId?.trim()) && ["medical_management_completed", "procedure_completed", "treatment_completed"].includes(evidence.completion);
}

/** A downstream projection must pass the clinical completion record, never infer conversion from a financial or appointment event. */
export function requireEligibleConversion(evidence: Pick<ConversionEvidence, "completion" | "evidenceId">): void {
  if (!isEligibleConversion(evidence)) throw new Error("Conversion requires eligible completed-treatment evidence");
}

/** Counts lead episodes rather than ledger or treatment rows, preventing event multiplication. */
export function uniqueEligibleConversions(evidence: readonly ConversionEvidence[]): string[] {
  const eligible = evidence.filter(isEligibleConversion).sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
  return [...new Set(eligible.map((entry) => entry.leadId))];
}

export function sumMinorByCurrency(entries: readonly { amountMinor: number; currency: string }[]): Record<string, number> {
  return entries.reduce<Record<string, number>>((totals, entry) => {
    if (!Number.isSafeInteger(entry.amountMinor) || !/^[A-Z]{3}$/.test(entry.currency)) throw new Error("Invalid minor-unit ledger entry");
    totals[entry.currency] = (totals[entry.currency] ?? 0) + entry.amountMinor;
    return totals;
  }, {});
}
