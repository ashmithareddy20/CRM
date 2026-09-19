import { base64UrlDecode, base64UrlEncode, cryptoBytes, utf8 } from "./encoding";

export interface KeyVersionManifest { readonly algorithm: "AES-GCM"; readonly activeVersion: string; readonly versions: readonly string[]; readonly generatedAt: string; }
export function keyVersionManifest(env: { FIELD_ENCRYPTION_KEYS?: string; FIELD_ENCRYPTION_ACTIVE_VERSION?: string }, now = new Date()): KeyVersionManifest {
  const keys = env.FIELD_ENCRYPTION_KEYS ? JSON.parse(env.FIELD_ENCRYPTION_KEYS) as Record<string, string> : {};
  const versions = Object.keys(keys).sort(); const activeVersion = env.FIELD_ENCRYPTION_ACTIVE_VERSION;
  if (!activeVersion || !versions.includes(activeVersion)) throw new Error("Active encryption key version is unavailable");
  for (const version of versions) if (base64UrlDecode(keys[version]).length !== 32) throw new Error(`Key ${version} is not 256 bits`);
  return { algorithm: "AES-GCM", activeVersion, versions, generatedAt: now.toISOString() };
}
export async function manifestDigest(manifest: KeyVersionManifest): Promise<string> {
  const value = await crypto.subtle.digest("SHA-256", cryptoBytes(utf8(JSON.stringify(manifest))));
  return base64UrlEncode(new Uint8Array(value));
}
/** Only verifies decryptability; it never writes plaintext to a backup manifest or log. */
export async function verifyKeyRecovery(env: { FIELD_ENCRYPTION_KEYS?: string; FIELD_ENCRYPTION_ACTIVE_VERSION?: string }): Promise<void> {
  const manifest = keyVersionManifest(env); const keys = JSON.parse(env.FIELD_ENCRYPTION_KEYS ?? "{}") as Record<string, string>;
  const key = await crypto.subtle.importKey("raw", cryptoBytes(base64UrlDecode(keys[manifest.activeVersion])), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12)); const plaintext = cryptoBytes(utf8("backup-key-verification"));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const recovered = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  if (new TextDecoder().decode(recovered) !== "backup-key-verification") throw new Error("Key recovery verification failed");
}
