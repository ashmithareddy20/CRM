import { z } from "zod";
import { ApiError } from "./errors";

export const MAX_JSON_BODY_BYTES = 64 * 1024;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const cursorPaginationSchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
}).strict();

export type CursorPagination = z.infer<typeof cursorPaginationSchema>;

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength && Number(contentLength) > MAX_JSON_BODY_BYTES) {
    throw new ApiError("INVALID_REQUEST", 413, "Request body exceeds the 64 KiB limit");
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError("INVALID_REQUEST", 413, "Request body exceeds the 64 KiB limit");
  }
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw new ApiError("INVALID_REQUEST", 400, "Request body must be valid JSON");
  }
}

export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) fields[issue.path.join(".") || "body"] = issue.message;
  throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", fields);
}

export function parsePagination(url: URL): CursorPagination {
  const page = parse(cursorPaginationSchema, { cursor: url.searchParams.get("cursor") ?? undefined, limit: url.searchParams.get("limit") ?? undefined });
  return { limit: page.limit ?? DEFAULT_PAGE_SIZE, ...(page.cursor ? { cursor: page.cursor } : {}) };
}
