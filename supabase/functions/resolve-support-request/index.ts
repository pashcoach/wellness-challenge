import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
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
    return response({ error: "Support notification service is not configured" }, 500);
  }
  if (!authorization) return response({ error: "Authentication required" }, 401);

  let requestId = "";
  try {
    const body = await request.json();
    requestId = typeof body?.requestId === "string" ? body.requestId : "";
  } catch {
    return response({ error: "Invalid request body" }, 400);
  }
  if (!uuidPattern.test(requestId)) return response({ error: "Invalid support request ID" }, 400);

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
    .select("id, user_id, status, resolution_email_sent_at")
    .eq("id", requestId)
    .single();
  if (supportError || !supportRequest) return response({ error: "Support request not found" }, 404);

  if (supportRequest.status === "resolved" && supportRequest.resolution_email_sent_at) {
    return response({ status: "resolved", emailSent: true, alreadyNotified: true });
  }

  const { data: participantData, error: participantError } = await adminClient.auth.admin.getUserById(supportRequest.user_id);
  const participantEmail = participantData.user?.email;
  if (participantError || !participantEmail) return response({ error: "Participant email is unavailable" }, 422);

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `support-resolved-${requestId}`,
    },
    body: JSON.stringify({
      from: "FCL Wellness Challenge <notifications@fclwellnesschallengeapp.ca>",
      to: [participantEmail],
      subject: "Your Wellness Challenge support request is resolved",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1e293b;max-width:560px;margin:0 auto">
          <h2 style="color:#047857">Your support request is resolved</h2>
          <p>The FCL Wellness Challenge app team has marked your support request as resolved.</p>
          <p>To review its status, sign in and open <strong>Need help?</strong>, then view <strong>My support requests</strong>.</p>
          <p><a href="https://fclwellnesschallengeapp.ca" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">Open the Wellness Challenge</a></p>
          <p style="font-size:12px;color:#64748b">If you still need help, submit another message through the app.</p>
        </div>
      `,
      text: "Your FCL Wellness Challenge support request has been resolved. Sign in at https://fclwellnesschallengeapp.ca and open Need help? > My support requests to review its status. If you still need help, submit another message through the app.",
    }),
  });

  if (!emailResponse.ok) {
    console.error("Resend rejected support resolution email", emailResponse.status, await emailResponse.text());
    return response({ error: "The resolution email could not be sent. The request was not marked resolved." }, 502);
  }

  const sentAt = new Date().toISOString();
  const { error: updateError } = await adminClient
    .from("survey_responses")
    .update({ status: "resolved", updated_at: sentAt, resolution_email_sent_at: sentAt })
    .eq("id", requestId);
  if (updateError) {
    console.error("Resolution email sent but status update failed", updateError);
    return response({ error: "The email was accepted, but the request status could not be saved." }, 500);
  }

  return response({ status: "resolved", emailSent: true });
});
