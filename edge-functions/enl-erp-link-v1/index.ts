/* Isolated ERP handoff reference registry. No direct ERP API, no incident writes. */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";

const ORIGIN = "https://enlsafety.github.io";
const APP = "incident-report-v2";
const VERSION = "erp-handoff-v1";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "content-type,x-enl-app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  Vary: "Origin"
};
const send = (body, code = 200) => new Response(JSON.stringify(body), { status: code, headers: cors });
const txt = v => String(v == null ? "" : v).trim();
const historical = i => !!i && (txt(i.recordMode) === "historical_transfer"
  || txt(i.historicalTransfer?.mode) === "historical_transfer"
  || (i.historicalImport?.enabled === true && i.historicalImport?.erpApproved === true));
const ready = i => !!i && !historical(i) && txt(i.status) === "closed" && txt(i.corrective?.status) === "approved";
const clash = () => Object.assign(new Error("version_conflict"), { code: "version_conflict" });
function record(row) {
  return row ? {
    incidentId: txt(row.incident_id),
    erpDocumentNo: txt(row.erp_document_no),
    erpStatus: txt(row.erp_status),
    revision: Number(row.revision),
    updatedAt: String(row.updated_at || "")
  } : null;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return send({ ok: false, message: "method_not_allowed" }, 405);
  const origin = req.headers.get("origin");
  if (origin && origin !== ORIGIN) return send({ ok: false, message: "origin_not_allowed" }, 403);
  if (req.headers.get("x-enl-app") !== APP) return send({ ok: false, message: "invalid_client" }, 403);
  const bodyText = await req.text().catch(() => "");
  if (!bodyText || bodyText.length > 4096) return send({ ok: false, message: "invalid_request" }, 400);
  let input;
  try { input = JSON.parse(bodyText); } catch (_) { return send({ ok: false, message: "invalid_json" }, 400); }
  const action = txt(input?.action);
  const actorId = txt(input?.actor?.id);
  const actorRole = txt(input?.actor?.role);
  const passwordProof = txt(input?.actorPasswordHash);
  const incidentId = txt(input?.incidentId);
  if (!["get", "save"].includes(action) || !actorId || actorId.length > 120
      || actorRole !== "safety" || !passwordProof || !incidentId || incidentId.length > 120) {
    return send({ ok: false, message: "forbidden" }, 403);
  }
  const dbUrl = Deno.env.get("SUPABASE_DB_URL") || "";
  if (!dbUrl) return send({ ok: false, message: "server_not_configured" }, 500);
  const sql = postgres(dbUrl, { max: 2, prepare: false, connect_timeout: 5, idle_timeout: 2 });
  try {
    const [account] = await sql`select user_id,active,role,password_hash
      from public.enl_hq_users where user_id = ${actorId} limit 1`;
    // Existing incident app uses a password hash as proof. Never trust client role or incident status.
    if (!account || account.active !== true || txt(account.role) !== "safety"
        || !txt(account.password_hash) || passwordProof !== txt(account.password_hash)) {
      return send({ ok: false, message: "auth_proof_required" }, 403);
    }
    const [incidentRow] = await sql`select site_id,payload
      from public.enl_incident_shared where incident_id = ${incidentId} limit 1`;
    if (!incidentRow) return send({ ok: false, message: "not_found" }, 404);
    const incident = incidentRow.payload && typeof incidentRow.payload === "object" ? incidentRow.payload : null;
    if (!ready(incident)) return send({ ok: false, message: "not_finalized" }, 409);
    if (action === "get") {
      const [current] = await sql`select incident_id,erp_document_no,erp_status,revision,updated_at
        from public.enl_erp_document_links where incident_id = ${incidentId} limit 1`;
      return send({ ok: true, record: record(current) });
    }
    const doc = txt(input.erpDocumentNo);
    const status = txt(input.erpStatus);
    const rev = input.expectedRevision;
    if (!doc || doc.length > 80 || /[\x00-\x1f\x7f<>]/.test(doc)
        || !["submitted", "approved"].includes(status)
        || !Number.isSafeInteger(rev) || rev < 0 || rev > 2147483646) {
      return send({ ok: false, message: "invalid_fields" }, 400);
    }
    const current = await sql.begin(async tx => {
      // Lock only the authoritative incident row; no changes to it.
      const [nowIncident] = await tx`select site_id,payload from public.enl_incident_shared
        where incident_id = ${incidentId} for share`;
      if (!nowIncident || !ready(nowIncident.payload)) throw Object.assign(new Error("not_finalized"), { code: "not_finalized" });
      const [prev] = await tx`select erp_document_no,erp_status,revision from public.enl_erp_document_links
        where incident_id = ${incidentId} for update`;
      if ((prev ? Number(prev.revision) : 0) !== rev) throw clash();
      const [saved] = prev
        ? await tx`update public.enl_erp_document_links
            set erp_document_no=${doc},erp_status=${status},revision=revision+1,
                updated_by=${actorId},updated_at=now()
            where incident_id=${incidentId} and revision=${rev}
            returning incident_id,erp_document_no,erp_status,revision,updated_at`
        : await tx`insert into public.enl_erp_document_links
            (incident_id,site_id,erp_document_no,erp_status,created_by,updated_by)
            values (${incidentId},${nowIncident.site_id},${doc},${status},${actorId},${actorId})
            returning incident_id,erp_document_no,erp_status,revision,updated_at`;
      if (!saved) throw clash();
      await tx`insert into public.enl_erp_document_link_audit
        (incident_id,before_document_no,before_status,after_document_no,after_status,revision,changed_by)
        values (${incidentId},${prev?.erp_document_no || null},${prev?.erp_status || null},
                ${doc},${status},${saved.revision},${actorId})`;
      return saved;
    });
    return send({ ok: true, record: record(current) });
  } catch (err) {
    if (err?.code === "version_conflict" || err?.code === "23505") return send({ ok: false, message: "version_conflict" }, 409);
    if (err?.code === "not_finalized") return send({ ok: false, message: "not_finalized" }, 409);
    console.error("[erp-handoff] query failed", String(err?.code || "server_error"));
    return send({ ok: false, message: "server_error" }, 500);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
});
