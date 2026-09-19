export type PrimaryReason = "financial" | "interest" | "follow_up_failure" | "hospital_or_doctor" | "competition" | "lead_quality" | "contactability" | "clinical_eligibility";
export type Recoverability = "recoverable" | "long_term_nurture" | "genuine_lost" | "invalid_non_actionable";

/** The published non-conversion taxonomy. Values are stable codes, not free-text labels. */
export const REASON_TAXONOMY = {
  financial: ["treatment_cost_high", "discount_requested", "emi_required", "insurance_unavailable", "budget_insufficient", "financial_counseling_not_completed", "package_above_budget"],
  interest: ["not_interested", "firmly_not_interested", "general_enquiry", "no_current_requirement", "wants_to_wait", "symptoms_reduced", "surgery_fear", "family_approval_pending", "waiting_for_leave", "waiting_for_reports"],
  follow_up_failure: ["first_response_delayed", "follow_up_missed", "insufficient_calls", "message_not_sent", "wrong_information_provided", "patient_query_unresolved"],
  hospital_or_doctor: ["doctor_confidence_issue", "requested_another_doctor", "hospital_too_far", "branch_unavailable", "appointment_timing_unsuitable", "waiting_time_issue", "doctor_callback_required"],
  competition: ["chose_another_hospital", "lower_competitor_price", "continued_with_existing_doctor", "preferred_local_facility", "already_treated_elsewhere", "local_hospital_selected"],
  lead_quality: ["wrong_number", "duplicate", "fake_lead", "out_of_location", "unrelated_enquiry", "invalid_lead", "out_of_service_area"],
  contactability: ["not_lifting", "switched_off", "call_rejected", "invalid_number", "no_whatsapp", "repeatedly_unreachable"],
  clinical_eligibility: ["clinically_ineligible"],
} as const satisfies Record<PrimaryReason, readonly string[]>;

export type SecondaryReason = (typeof REASON_TAXONOMY)[PrimaryReason][number];
export const VALID_SECONDARY_REASONS = new Set<string>(Object.values(REASON_TAXONOMY).flat());
export const primaryForSecondary = (secondary: string): PrimaryReason | undefined =>
  (Object.entries(REASON_TAXONOMY) as Array<[PrimaryReason, readonly string[]]>).find(([, values]) => values.includes(secondary))?.[0];

export interface CorrectiveAction { code: string; label: string; role: "financial_counselor" | "clinician" | "agent" | "manager" | "operations"; }
const actions = (role: CorrectiveAction["role"], entries: Array<[string, string]>) => entries.map(([code, label]) => ({ code, label, role }));
export const CORRECTIVE_ACTIONS: Readonly<Record<PrimaryReason, readonly CorrectiveAction[]>> = {
  financial: actions("financial_counselor", [["financial_counselor_call", "Financial counselor call"], ["package_explanation", "Package explanation"], ["emi_option", "EMI option review"], ["insurance_check", "Insurance eligibility check"], ["controlled_discount_review", "Controlled discount approval review"], ["value_comparison", "Value comparison"]]),
  interest: actions("agent", [["patient_requested_date", "Confirm patient-requested follow-up date"], ["treatment_education", "Send treatment education"], ["family_counseling", "Offer family counseling"], ["surgery_fear_counseling", "Offer surgery-fear counseling"]]),
  follow_up_failure: actions("manager", [["follow_up_audit", "Audit missed or delayed follow-up"], ["response_sla_review", "Review first-response SLA"], ["query_resolution", "Resolve outstanding patient query"], ["content_delivery_review", "Review missing message/content delivery"]]),
  hospital_or_doctor: actions("operations", [["doctor_callback", "Arrange doctor callback"], ["doctor_profile", "Share doctor profile and credentials"], ["video_consultation", "Offer video consultation"], ["branch_or_slot_review", "Review branch or appointment availability"]]),
  competition: actions("manager", [["competitor_analysis", "Record competitor/location learning"], ["value_comparison", "Provide value comparison"], ["local_support_review", "Review local branch/support option"]]),
  lead_quality: actions("operations", [["lead_validation", "Validate lead/source quality"], ["dedup_review", "Review duplicate lead relationship"], ["source_quality_finding", "Create source-quality management finding"]]),
  contactability: actions("operations", [["contact_verification", "Verify contact details"], ["contactability_analysis", "Analyze contactability failure"]]),
  clinical_eligibility: actions("clinician", [["clinical_eligibility_review", "Record clinician eligibility decision"]]),
};

/** These are never eligible even if a caller attempts to mark them recoverable. */
export const REACTIVATION_EXCLUDED_REASONS = new Set<string>([
  "firmly_not_interested", "wrong_number", "invalid_number", "invalid_lead", "fake_lead", "duplicate", "already_treated_elsewhere", "local_hospital_selected", "chose_another_hospital", "clinically_ineligible",
]);
