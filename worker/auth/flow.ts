import { base64UrlEncode, cryptoBytes, utf8 } from "../security/encoding";
import { oidcConfig, type SecurityConfigSource } from "../security/config";

export interface OidcTransaction { id: string; state: string; nonce: string; verifier: string; redirectUri: string; expiresAt: Date; }
export interface OidcTransactionStore { put(transaction: OidcTransaction): Promise<void>; take(state: string, now: Date): Promise<OidcTransaction | undefined>; }
export interface OidcFlowConfig extends SecurityConfigSource { OIDC_AUTHORIZATION_ENDPOINT?: string; OIDC_TOKEN_ENDPOINT?: string; OIDC_CLIENT_ID?: string; OIDC_REDIRECT_URI?: string; }

function requiredHttps(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} must be configured`);
  const url = new URL(value); if (url.protocol !== "https:") throw new Error(`${name} must use HTTPS`); return url.toString();
}
function random(byteLength = 32): string { return base64UrlEncode(crypto.getRandomValues(new Uint8Array(byteLength))); }
async function challenge(verifier: string): Promise<string> { return base64UrlEncode(new Uint8Array(await crypto.subtle.digest("SHA-256", cryptoBytes(utf8(verifier))))); }

/** Starts confidential browser OIDC using persisted, one-time state and PKCE verifier. */
export async function beginOidcAuthorization(env: OidcFlowConfig, store: OidcTransactionStore, now = new Date()): Promise<{ authorizationUrl: string; transaction: Omit<OidcTransaction, "verifier"> }> {
  const issuer = oidcConfig(env); const endpoint = requiredHttps(env.OIDC_AUTHORIZATION_ENDPOINT, "OIDC authorization endpoint");
  const redirectUri = requiredHttps(env.OIDC_REDIRECT_URI, "OIDC redirect URI"); if (!env.OIDC_CLIENT_ID) throw new Error("OIDC client ID must be configured");
  const transaction: OidcTransaction = { id: crypto.randomUUID(), state: random(), nonce: random(), verifier: random(48), redirectUri, expiresAt: new Date(now.getTime() + 10 * 60_000) };
  await store.put(transaction);
  const url = new URL(endpoint); url.search = new URLSearchParams({ response_type: "code", client_id: env.OIDC_CLIENT_ID, redirect_uri: redirectUri, scope: "openid profile email", state: transaction.state, nonce: transaction.nonce, code_challenge: await challenge(transaction.verifier), code_challenge_method: "S256", issuer: issuer.issuer }).toString();
  const { verifier: _verifier, ...publicTransaction } = transaction; return { authorizationUrl: url.toString(), transaction: publicTransaction };
}

export async function exchangeOidcCallback(input: { code: string; state: string; env: OidcFlowConfig; store: OidcTransactionStore; fetcher?: typeof fetch; now?: Date }): Promise<{ idToken: string; transaction: Pick<OidcTransaction, "nonce" | "redirectUri" | "id" | "expiresAt"> }> {
  const now = input.now ?? new Date(); const transaction = await input.store.take(input.state, now);
  if (!transaction || transaction.state !== input.state || transaction.expiresAt <= now || !input.code) throw new Error("OIDC callback state is invalid or expired");
  const endpoint = requiredHttps(input.env.OIDC_TOKEN_ENDPOINT, "OIDC token endpoint"); if (!input.env.OIDC_CLIENT_ID) throw new Error("OIDC client ID must be configured");
  const body = new URLSearchParams({ grant_type: "authorization_code", code: input.code, redirect_uri: transaction.redirectUri, client_id: input.env.OIDC_CLIENT_ID, code_verifier: transaction.verifier });
  const response = await (input.fetcher ?? fetch)(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body });
  if (!response.ok) throw new Error("OIDC code exchange failed");
  const payload = await response.json() as { id_token?: unknown }; if (typeof payload.id_token !== "string") throw new Error("OIDC token response lacks an ID token");
  const { verifier: _verifier, state: _state, ...callbackTransaction } = transaction;
  return { idToken: payload.id_token, transaction: callbackTransaction };
}

/** Validates the nonce only after signature/issuer/audience validation of the ID token. */
export function requireOidcNonce(claims: Record<string, unknown>, transaction: Pick<OidcTransaction, "nonce">): void { if (claims.nonce !== transaction.nonce) throw new Error("OIDC nonce is invalid"); }
