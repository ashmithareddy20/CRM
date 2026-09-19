import { base64UrlDecode, cryptoBytes, utf8, utf8Decode } from "../security/encoding";
import { oidcConfig, type JwtAlgorithm, type OidcConfig, type SecurityConfigSource } from "../security/config";

export interface VerifiedOidcIdentity { issuer: string; subject: string; audience: readonly string[]; claims: Record<string, unknown>; authenticatedAt?: Date }
type Header = { alg: JwtAlgorithm; kid?: string; typ?: string };
type Claims = Record<string, unknown> & { iss?: string; sub?: string; aud?: string | string[]; exp?: number; nbf?: number; iat?: number; auth_time?: number };
type Jwk = JsonWebKey & { kid?: string; use?: string };
type Jwks = { keys: Jwk[] };
const jwksCache = new Map<string, { expiresAt: number; keys: Jwks }>();

function jsonPart<T>(part: string): T {
  try { return JSON.parse(utf8Decode(base64UrlDecode(part))) as T; } catch { throw new Error("JWT contains invalid JSON"); }
}
function algorithmParameters(algorithm: JwtAlgorithm): AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams {
  if (algorithm.startsWith("RS")) return { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${algorithm.slice(2)}` } as RsaHashedImportParams;
  return { name: "ECDSA", namedCurve: algorithm === "ES256" ? "P-256" : algorithm === "ES384" ? "P-384" : "P-521" } as EcKeyImportParams;
}
function verifyParameters(algorithm: JwtAlgorithm): AlgorithmIdentifier | EcdsaParams {
  return algorithm.startsWith("RS") ? { name: "RSASSA-PKCS1-v1_5" } : { name: "ECDSA", hash: `SHA-${algorithm.slice(2)}` };
}
function jwksEndpoint(config: OidcConfig): string { return config.jwksUrl ?? `${config.issuer}/.well-known/jwks.json`; }

async function jwks(config: OidcConfig, fetcher: typeof fetch): Promise<Jwks> {
  const url = jwksEndpoint(config); const cached = jwksCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;
  const response = await fetcher(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("OIDC JWKS is unavailable");
  const keys = await response.json() as Jwks;
  if (!Array.isArray(keys.keys)) throw new Error("OIDC JWKS is malformed");
  jwksCache.set(url, { keys, expiresAt: Date.now() + 5 * 60_000 });
  return keys;
}

export async function verifyOidcJwt(token: string, env: SecurityConfigSource, options: { now?: Date; fetcher?: typeof fetch } = {}): Promise<VerifiedOidcIdentity> {
  const config = oidcConfig(env); const pieces = token.split(".");
  if (pieces.length !== 3) throw new Error("JWT must have three parts");
  const header = jsonPart<Header>(pieces[0]); const claims = jsonPart<Claims>(pieces[1]);
  if (!header.alg || !config.algorithms.includes(header.alg) || !header.kid) throw new Error("JWT algorithm or key ID is not allowed");
  const key = (await jwks(config, options.fetcher ?? fetch)).keys.find((candidate) => candidate.kid === header.kid && candidate.kty && candidate.use !== "enc");
  if (!key) throw new Error("JWT signing key is unavailable");
  const imported = await crypto.subtle.importKey("jwk", key, algorithmParameters(header.alg), false, ["verify"]);
  if (!await crypto.subtle.verify(verifyParameters(header.alg), imported, cryptoBytes(base64UrlDecode(pieces[2])), cryptoBytes(utf8(`${pieces[0]}.${pieces[1]}`)))) throw new Error("JWT signature is invalid");
  const now = Math.floor((options.now?.getTime() ?? Date.now()) / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud : typeof claims.aud === "string" ? [claims.aud] : [];
  if (claims.iss !== config.issuer || !claims.sub || !audience.includes(config.audience) || typeof claims.exp !== "number" || claims.exp <= now || (typeof claims.nbf === "number" && claims.nbf > now)) throw new Error("JWT claims are invalid");
  return { issuer: claims.iss, subject: claims.sub, audience, claims, ...(typeof claims.auth_time === "number" ? { authenticatedAt: new Date(claims.auth_time * 1000) } : {}) };
}
