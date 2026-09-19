export interface SecurityConfigSource {
  DEPLOYMENT_ENV?: string;
  ALLOW_TEST_IDENTITY?: string;
  OIDC_ISSUER?: string;
  OIDC_AUDIENCE?: string;
  OIDC_ALLOWED_ALGORITHMS?: string;
  OIDC_JWKS_URL?: string;
  OIDC_AUTHORIZATION_ENDPOINT?: string;
  OIDC_TOKEN_ENDPOINT?: string;
  OIDC_CLIENT_ID?: string;
  OIDC_REDIRECT_URI?: string;
  CORS_ALLOWED_ORIGINS?: string;
  FIELD_ENCRYPTION_KEYS?: string;
  FIELD_ENCRYPTION_ACTIVE_VERSION?: string;
  BLIND_INDEX_KEY?: string;
  AUDIT_ANCHOR_KEY?: string;
  SESSION_SIGNING_KEY?: string;
  TEST_IDENTITY_SECRET?: string;
}

export interface OidcConfig { issuer: string; audience: string; algorithms: readonly JwtAlgorithm[]; jwksUrl?: string }
export type JwtAlgorithm = "RS256" | "RS384" | "RS512" | "ES256" | "ES384" | "ES512";
const supportedAlgorithms = new Set<JwtAlgorithm>(["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"]);

function values(value?: string): string[] { return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean); }

export function oidcConfig(env: SecurityConfigSource): OidcConfig {
  const issuer = env.OIDC_ISSUER?.replace(/\/$/u, "");
  const audience = env.OIDC_AUDIENCE?.trim();
  const algorithms = values(env.OIDC_ALLOWED_ALGORITHMS || "RS256");
  if (!issuer || !/^https:\/\//u.test(issuer) || !audience || algorithms.length === 0 || !algorithms.every((algorithm): algorithm is JwtAlgorithm => supportedAlgorithms.has(algorithm as JwtAlgorithm))) {
    throw new Error("OIDC issuer, audience, and supported allowed algorithms must be configured");
  }
  const jwksUrl = env.OIDC_JWKS_URL?.trim();
  if (jwksUrl && new URL(jwksUrl).protocol !== "https:") throw new Error("OIDC JWKS URL must use HTTPS");
  return { issuer, audience, algorithms: algorithms as JwtAlgorithm[], ...(jwksUrl ? { jwksUrl } : {}) };
}

export function corsOrigins(env: SecurityConfigSource): readonly string[] {
  return values(env.CORS_ALLOWED_ORIGINS).filter((origin) => {
    try { return new URL(origin).origin === origin && new URL(origin).protocol === "https:"; } catch { return false; }
  });
}

export function production(env: SecurityConfigSource): boolean { return env.DEPLOYMENT_ENV === "production"; }
