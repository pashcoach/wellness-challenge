export const SUPPORT_REPLY_MAX = 2000;

export type SupportCategory = "feedback" | "help" | "problem" | "idea";

export type SupportReplySuggestion = {
  fullName: string | null | undefined;
  category: SupportCategory;
  feedback: string;
};

/** Build a privacy-safe starting draft. It never claims an action was completed. */
export function suggestSupportReply({ fullName, category, feedback }: SupportReplySuggestion): string {
  const firstName = fullName?.trim().split(/\s+/)[0] || "there";
  const normalized = feedback.toLowerCase();
  let responseLine: string;

  if (category === "idea") {
    responseLine = "Thank you for the suggestion. We’ll review it with the app team.";
  } else if (category === "feedback") {
    responseLine = "Thank you for sharing your feedback. We’ll review it with the app team.";
  } else if (/\b(team|join|switch|leave)\b/.test(normalized)) {
    responseLine = "We’re reviewing your team membership request and will follow up after checking the requested team details.";
  } else if (/\b(password|sign[ -]?in|log[ -]?in|email)\b/.test(normalized)) {
    responseLine = "We’re reviewing your account-access request and will follow up with the next steps.";
  } else if (/\b(points?|activity|check[ -]?in|entry)\b/.test(normalized)) {
    responseLine = "We’re reviewing the reported challenge entry or points and will follow up after checking your account.";
  } else if (category === "problem") {
    responseLine = "We’re looking into the issue you reported and will follow up once we have more information.";
  } else {
    responseLine = "We’re reviewing your request and will follow up with the next steps.";
  }

  return `Hi ${firstName},\n\nThanks for contacting the FCL Wellness Challenge app team. ${responseLine}\n\nThanks,\nFCL Wellness Challenge App Team\nEndurance Journey`;
}

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
