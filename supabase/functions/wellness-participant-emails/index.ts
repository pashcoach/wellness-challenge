import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const EXPECTED_TOKEN_HASH = "689f280a795ea720d8568466f31e883dbd7da12d615cde432b2e0a440f5809f7";

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token || await sha256(token) !== EXPECTED_TOKEN_HASH) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const client = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: profileRows, error: profileError } = await client.from("profiles").select("id");
    if (profileError) throw profileError;
    const profileIds = new Set((profileRows ?? []).map((row) => row.id));
    const { data: routes, error: routeError } = await client
      .from("campaign_email_routing").select("user_id,email_override,suppress");
    if (routeError) throw routeError;
    const routing = new Map((routes ?? []).map((route) => [route.user_id, route]));
    const { data: userData, error: userError } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (userError) throw userError;
    const emails = userData.users
      .filter((user) => profileIds.has(user.id))
      .map((user) => {
        const route = routing.get(user.id);
        if (route?.suppress) return null;
        return (route?.email_override ?? user.email)?.trim().toLowerCase() ?? null;
      })
      .filter((email): email is string => Boolean(email))
      .filter((email, index, all) => all.indexOf(email) === index)
      .sort();
    return Response.json({ count: emails.length, emails }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Participant list unavailable" }, { status: 500 });
  }
});
