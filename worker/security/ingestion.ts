import { requirePatientDataPolicy, type PolicyRegistry, type RetentionClass } from "./retention";

export interface IngestionGateEnvironment { DEPLOYMENT_ENV?: string; PATIENT_DATA_INGESTION?: string; }
export interface IngestionRequest { tenantId: string; source: "manual" | "import" | "provider_webhook" | "public_form"; containsPatientData: boolean; synthetic?: boolean; dataClass?: RetentionClass; }
/** Entry points must call this before parsing/persisting patient identifiers or provider payloads. */
export async function requireIngestionAllowed(env: IngestionGateEnvironment, registry: PolicyRegistry | undefined, request: IngestionRequest): Promise<void> {
  if (!request.containsPatientData) return;
  const mode = env.PATIENT_DATA_INGESTION;
  if (env.DEPLOYMENT_ENV === "test" && request.synthetic) return;
  if (mode !== "reviewed_policy" || !registry) throw new Error("Patient data ingestion is blocked until reviewed policy approval");
  await requirePatientDataPolicy(registry, { tenantId: request.tenantId, environment: env.DEPLOYMENT_ENV ?? "production", dataClass: request.dataClass ?? "lead" });
}
