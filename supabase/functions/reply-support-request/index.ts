import { createClient } from "npm:@supabase/supabase-js@2.110.8";

// Sends a typed app-team reply to a participant's support request.
// Admin-only. The reply is saved first, then emailed; if the email fails the
// saved reply is removed so the administrator can simply try again.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REPLY_MAX = 2000;
const APP_URL = "https://fclwellnesschallengeapp.ca";

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstName(fullName: string | null | undefined) {
  const name = (fullName ?? "").trim().split(/\s+/)[0];
  return name || "there";
}

function excerpt(value: string, max = 500) {
  const text = value.trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey) {
    return response({ error: "Support reply service is not configured" }, 500);
  }
  if (!authorization) return response({ error: "Authentication required" }, 401);

  let requestId = "";
  let reply = "";
  let markResolved = false;
  try {
    const body = await request.json();
    requestId = typeof body?.requestId === "string" ? body.requestId : "";
    reply = typeof body?.message === "string" ? body.message.trim() : "";
    markResolved = body?.markResolved === true;
  } catch {
    return response({ error: "Invalid request body" }, 400);
  }
  if (!uuidPattern.test(requestId)) return response({ error: "Invalid support request ID" }, 400);
  if (!reply) return response({ error: "Type a reply before sending." }, 400);
  if (reply.length > REPLY_MAX) return response({ error: `Replies can be up to ${REPLY_MAX} characters.` }, 400);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return response({ error: "Authentication required" }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: adminProfile, error: adminError } = await adminClient
    .from("profiles")
    .select("is_admin")
    .eq("id", userData.user.id)
    .single();
  if (adminError || adminProfile?.is_admin !== true) return response({ error: "Administrator access required" }, 403);

  const { data: supportRequest, error: supportError } = await adminClient
    .from("survey_responses")
    .select("id, user_id, feedback, status")
    .eq("id", requestId)
    .single();
  if (supportError || !supportRequest) return response({ error: "Support request not found" }, 404);

  const { data: participantData, error: participantError } = await adminClient.auth.admin.getUserById(supportRequest.user_id);
  const participantEmail = participantData.user?.email;
  if (participantError || !participantEmail) return response({ error: "Participant email is unavailable" }, 422);

  const { data: participantProfile } = await adminClient
    .from("profiles")
    .select("full_name")
    .eq("id", supportRequest.user_id)
    .maybeSingle();

  const { data: replyRow, error: insertError } = await adminClient
    .from("support_replies")
    .insert({ request_id: requestId, author_id: userData.user.id, body: reply })
    .select("id, created_at")
    .single();
  if (insertError || !replyRow) {
    console.error("Support reply could not be saved", insertError);
    return response({ error: "The reply could not be saved. Nothing was sent." }, 500);
  }

  const name = escapeHtml(firstName(participantProfile?.full_name));
  const replyHtml = escapeHtml(reply).replace(/\n/g, "<br>");
  const originalHtml = escapeHtml(excerpt(supportRequest.feedback)).replace(/\n/g, "<br>");
  const resolvedLine = markResolved
    ? "<p>We have marked your request as <strong>resolved</strong>.</p>"
    : "";

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `support-reply-${replyRow.id}`,
    },
    body: JSON.stringify({
      from: "FCL Wellness Challenge <notifications@fclwellnesschallengeapp.ca>",
      to: [participantEmail],
      subject: "The app team replied to your Wellness Challenge support request",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1e293b;max-width:560px;margin:0 auto">
          <h2 style="color:#047857">The app team replied to your request</h2>
          <p>Hi ${name},</p>
          <div style="border-left:4px solid #059669;background:#ecfdf5;padding:12px 16px;border-radius:6px">${replyHtml}</div>
          ${resolvedLine}
          <p style="font-size:13px;color:#64748b;margin-top:20px">Your original message:</p>
          <div style="border-left:4px solid #cbd5e1;padding:8px 14px;color:#475569;font-size:13px">${originalHtml}</div>
          <p style="margin-top:20px">To follow up, sign in, open <strong>Need help?</strong>, and send a new message. You can see this reply under <strong>My support requests</strong>.</p>
          <p><a href="${APP_URL}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">Open the Wellness Challenge</a></p>
          <p style="font-size:12px;color:#64748b">The FCL Wellness Challenge is delivered by Endurance Journey in partnership with FCL. Please do not reply to this email; this mailbox is not monitored.</p>
        </div>
      `,
      text: [
        `Hi ${firstName(participantProfile?.full_name)},`,
        "",
        "The FCL Wellness Challenge app team replied to your support request:",
        "",
        reply,
        "",
        markResolved ? "We have marked your request as resolved.\n" : "",
        "Your original message:",
        excerpt(supportRequest.feedback),
        "",
        `To follow up, sign in at ${APP_URL}, open Need help?, and send a new message. You can see this reply under My support requests.`,
        "",
        "The FCL Wellness Challenge is delivered by Endurance Journey in partnership with FCL. Please do not reply to this email; this mailbox is not monitored.",
      ].join("\n"),
    }),
  });

  if (!emailResponse.ok) {
    console.error("Resend rejected support reply email", emailResponse.status, await emailResponse.text());
    await adminClient.from("support_replies").delete().eq("id", replyRow.id);
    return response({ error: "The reply email could not be sent. Nothing was saved; please try again." }, 502);
  }

  const sentAt = new Date().toISOString();
  await adminClient.from("support_replies").update({ email_sent_at: sentAt }).eq("id", replyRow.id);

  const statusUpdate = markResolved
    ? { status: "resolved", updated_at: sentAt, resolution_email_sent_at: sentAt }
    : supportRequest.status === "new"
      ? { status: "in_progress", updated_at: sentAt }
      : { updated_at: sentAt };
  const { error: updateError } = await adminClient
    .from("survey_responses")
    .update(statusUpdate)
    .eq("id", requestId);
  if (updateError) console.error("Reply sent but request status update failed", updateError);

  return response({
    replyId: replyRow.id,
    createdAt: replyRow.created_at,
    emailSentAt: sentAt,
    status: (statusUpdate as { status?: string }).status ?? supportRequest.status,
  });
});
