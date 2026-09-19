import { ApiError } from "../../api/errors";

/** Normalizes identifiers only; callers encrypt the returned identifiers before persistence. */
export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { email: "Email is invalid" });
  }
  return normalized;
}

/** Accepts an E.164 number or a national number only when an explicit country code is supplied. */
export function normalizePhone(phone: string, countryCallingCode?: string): string {
  const compact = phone.trim().replace(/[\s().-]/g, "");
  const digits = compact.startsWith("+") ? compact.slice(1) : countryCallingCode ? `${countryCallingCode}${compact.replace(/^0+/, "")}` : "";
  if (!/^\d{8,15}$/.test(digits) || digits.startsWith("0")) {
    throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { phone: "Phone must be E.164 or include an explicit country calling code" });
  }
  return `+${digits}`;
}

export function normalizeLocation(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
  return normalized || undefined;
}

export function normalizedIdentifiers(input: { phone?: string; email?: string; countryCallingCode?: string }): { phone?: string; email?: string } {
  return {
    ...(input.phone ? { phone: normalizePhone(input.phone, input.countryCallingCode) } : {}),
    ...(input.email ? { email: normalizeEmail(input.email) } : {}),
  };
}
