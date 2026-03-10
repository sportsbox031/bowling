export type ParsedServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  [key: string]: unknown;
};

export function parseServiceAccountJson(raw: string): ParsedServiceAccount {
  const parsed = JSON.parse(raw) as ParsedServiceAccount;
  if (typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}
