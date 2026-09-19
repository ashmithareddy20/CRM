import { base64UrlDecode, base64UrlEncode, cryptoBytes, utf8 } from "./encoding";
import type { SecurityConfigSource } from "./config";

export interface EncryptedField { version: string; iv: string; ciphertext: string }
export interface EncryptionContext { tenantId: string; recordId: string; purpose: string }

function keyring(env: SecurityConfigSource): Map<string, Uint8Array> {
  const parsed = env.FIELD_ENCRYPTION_KEYS ? JSON.parse(env.FIELD_ENCRYPTION_KEYS) as Record<string, string> : {};
  const result = new Map<string, Uint8Array>();
  for (const [version, value] of Object.entries(parsed)) {
    const key = base64UrlDecode(value);
    if (key.length !== 32) throw new Error(`Field encryption key ${version} must be 256 bits`);
    result.set(version, key);
  }
  return result;
}
function aad(context: EncryptionContext): Uint8Array { return utf8(`crm:v1:${context.tenantId}:${context.recordId}:${context.purpose}`); }
async function aesKey(bytes: Uint8Array): Promise<CryptoKey> { return crypto.subtle.importKey("raw", cryptoBytes(bytes), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]); }

export async function encryptField(value: string, context: EncryptionContext, env: SecurityConfigSource): Promise<string> {
  const version = env.FIELD_ENCRYPTION_ACTIVE_VERSION;
  const key = version ? keyring(env).get(version) : undefined;
  if (!version || !key) throw new Error("An active field encryption key is required");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: cryptoBytes(iv), additionalData: cryptoBytes(aad(context)), tagLength: 128 }, await aesKey(key), cryptoBytes(utf8(value)));
  return JSON.stringify({ version, iv: base64UrlEncode(iv), ciphertext: base64UrlEncode(new Uint8Array(ciphertext)) } satisfies EncryptedField);
}

export async function decryptField(serialized: string, context: EncryptionContext, env: SecurityConfigSource): Promise<string> {
  const value = JSON.parse(serialized) as EncryptedField;
  if (!value.version || !value.iv || !value.ciphertext) throw new Error("Malformed encrypted field");
  const key = keyring(env).get(value.version);
  if (!key) throw new Error("Encrypted field key version is unavailable");
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: cryptoBytes(base64UrlDecode(value.iv)), additionalData: cryptoBytes(aad(context)), tagLength: 128 }, await aesKey(key), cryptoBytes(base64UrlDecode(value.ciphertext)));
  return new TextDecoder().decode(plaintext);
}

export async function blindIndex(value: string, tenantId: string, purpose: string, env: SecurityConfigSource): Promise<string> {
  if (!env.BLIND_INDEX_KEY) throw new Error("Blind index key is required");
  const key = await crypto.subtle.importKey("raw", cryptoBytes(base64UrlDecode(env.BLIND_INDEX_KEY)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const normalized = /email/iu.test(purpose) ? value.trim().toLowerCase() : value.replace(/[^+0-9]/gu, "");
  const signature = await crypto.subtle.sign("HMAC", key, cryptoBytes(utf8(`crm:v1:${tenantId}:${purpose}:${normalized}`)));
  return base64UrlEncode(new Uint8Array(signature));
}

