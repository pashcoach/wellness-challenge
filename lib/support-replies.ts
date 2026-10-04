export const SUPPORT_REPLY_MAX = 2000;

export type SupportReplyValidation = { ok: true; text: string } | { ok: false; error: string };

/** Trim and length-check an app-team reply before sending it. */
export function validateSupportReply(raw: string): SupportReplyValidation {
  const text = raw.trim();
  if (!text) return { ok: false, error: "Type a reply before sending." };
  if (text.length > SUPPORT_REPLY_MAX) {
    return { ok: false, error: `Replies can be up to ${SUPPORT_REPLY_MAX} characters.` };
  }
  return { ok: true, text };
}

export type SupportReply = {
  id: string;
  request_id: string;
  body: string;
  created_at: string;
  email_sent_at: string | null;
};
