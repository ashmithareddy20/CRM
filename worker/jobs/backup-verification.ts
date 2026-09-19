import { manifestDigest, keyVersionManifest, verifyKeyRecovery, type KeyVersionManifest } from "../security/keys";
import { replaySuppressionsBeforeJobs, type SuppressionReplayLedger } from "../security/retention";
export interface BackupManifest { version: 1; createdAt: string; environment: string; database: { exportKey: string; sha256: string }; objects: readonly { key: string; sha256: string; size: number }[]; config: { schemaVersion: string; configDigest: string }; keys: KeyVersionManifest; }
export interface BackupVerification { verifiedAt: string; manifestDigest: string; keyManifestDigest: string; restoredObjects: number; suppressionsReplayed: number; }
export function validateBackupManifest(manifest: BackupManifest): void {
  if (manifest.version !== 1 || !manifest.environment || !manifest.database.exportKey || !/^[a-f0-9]{64}$/iu.test(manifest.database.sha256) || !manifest.config.schemaVersion || !manifest.config.configDigest) throw new Error("Backup manifest is incomplete");
  if (new Set(manifest.objects.map((object) => object.key)).size !== manifest.objects.length || manifest.objects.some((object) => !object.key || object.size < 0 || !/^[a-f0-9]{64}$/iu.test(object.sha256))) throw new Error("Backup object manifest is invalid");
}
/** Verification runs against an isolated restore target. Suppressions replay before scheduled jobs are permitted. */
export async function verifyIsolatedRestore(input: { manifest: BackupManifest; env: { FIELD_ENCRYPTION_KEYS?: string; FIELD_ENCRYPTION_ACTIVE_VERSION?: string }; restoreDatabase: (key: string, sha256: string) => Promise<void>; restoreObject: (key: string, sha256: string) => Promise<void>; suppressions: readonly SuppressionReplayLedger[]; replaySuppression: (entry: SuppressionReplayLedger) => Promise<void>; /** Called only after all suppressions are replayed; use to release scheduler leases. */ resumeJobs?: () => Promise<void>; now?: Date }): Promise<BackupVerification> {
  validateBackupManifest(input.manifest); await verifyKeyRecovery(input.env);
  const currentKeys = keyVersionManifest(input.env); if (currentKeys.activeVersion !== input.manifest.keys.activeVersion || currentKeys.versions.join(",") !== input.manifest.keys.versions.join(",")) throw new Error("Backup key-version manifest cannot be recovered");
  await input.restoreDatabase(input.manifest.database.exportKey, input.manifest.database.sha256);
  for (const object of input.manifest.objects) await input.restoreObject(object.key, object.sha256);
  await replaySuppressionsBeforeJobs(input.suppressions, input.replaySuppression);
  await input.resumeJobs?.();
  return { verifiedAt: (input.now ?? new Date()).toISOString(), manifestDigest: await manifestDigest(input.manifest.keys), keyManifestDigest: await manifestDigest(currentKeys), restoredObjects: input.manifest.objects.length, suppressionsReplayed: input.suppressions.length };
}
