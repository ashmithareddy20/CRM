import { redirect } from "next/navigation";

export type ChatGPTUser = { displayName: string; email: string; fullName: string | null };

const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

/** Public request headers are not an authentication boundary. The CRM uses OIDC/session verification in the API. */
export async function getChatGPTUser(): Promise<ChatGPTUser | null> { return null; }

export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string { return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`; }
export function chatGPTSignOutPath(returnTo = "/"): string { return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`; }

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    return url.origin === "https://app.local" && ![SIGN_IN_PATH, SIGN_OUT_PATH, CALLBACK_PATH].includes(url.pathname) ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch { return "/"; }
}
