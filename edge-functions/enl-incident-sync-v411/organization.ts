const groups = 4;
const validText = (value:unknown, limit:number) => typeof value === 'string'
  && !!value.trim() && value.trim().length <= limit && !/[\u0000-\u001f\u007f]/.test(value);

function chartData(input:any) {
  if (!validText(input?.lead, 32) || !validText(input?.supervisor, 32)
      || !Array.isArray(input.teams) || input.teams.length !== groups) return null;
  const teams = [];
  for (const team of input.teams) {
    if (!validText(team?.name, 18) || ![team.regular, team.daily].every(n =>
      Number.isInteger(n) && n >= 0 && n <= 9999)) return null;
    teams.push({name:team.name.trim(), regular:team.regular, daily:team.daily});
  }
  return {lead:input.lead.trim(), supervisor:input.supervisor.trim(), teams};
}

export function halfYear(at = new Date()) {
  const kst = new Date(at.getTime() + 9 * 3600000);
  return kst.getUTCFullYear() + '-' + (kst.getUTCMonth() < 6 ? 1 : 2);
}

export async function organizationRequest(sql:any, actor:any, body:any, reply:any) {
  const field = actor.role === 'field';
  if (!field && !['safety','manager','executive'].includes(actor.role))
    return reply({ok:false, message:'forbidden'},403);
  const period = halfYear();
  const visible = field ? sql`s.site_id = ${actor.siteId}` : sql`true`;
  const recent = sql`left join lateral (
    select revision, period, confirmed, saved_at, actor_name from private.enl_org_charts
    where site_id=s.site_id order by revision desc limit 1
  ) v on true`;
  if (body.action === 'platform_org_list') {
    const sites = await sql`select s.site_id,s.site_name,s.active,v.revision,v.saved_at,
        coalesce(v.confirmed and v.period=${period},false) as checked
      from public.enl_site_master s ${recent}
      where ${visible} and s.site_id <> 'site-hq' and (s.active is not false or v.revision is not null)
      order by (s.active is false),s.site_name,s.site_id`;
    return reply({ok:true, period, sites});
  }
  const siteId = body.siteId;
  if (!validText(siteId,128) || (field && siteId !== actor.siteId))
    return reply({ok:false,message:'forbidden'},403);
  const [site] = await sql`select site_id,site_name,active from public.enl_site_master s
    where site_id=${siteId} and site_id <> 'site-hq' and ${visible}`;
  if (!site) return reply({ok:false,message:'site_unavailable'},404);
  if (body.action === 'platform_org_open') {
    if (body.revision != null && (!Number.isInteger(body.revision) || body.revision < 1))
      return reply({ok:false,message:'invalid_revision'},400);
    // One snapshot for both the history index and the selected document.
    const [result] = await sql`with versions as (
        select revision,period,confirmed,saved_at,actor_name,chart,site_name from private.enl_org_charts where site_id=${siteId}
      ) select (select jsonb_agg(to_jsonb(v)-'chart'-'site_name' order by revision desc) from versions v) as history,
        (select to_jsonb(v) from versions v where ${body.revision ?? null}::integer is null or revision=${body.revision ?? null}::integer order by revision desc limit 1) as document`;
    if (body.revision != null && !result.document) return reply({ok:false,message:'unavailable'},404);
    let template;
    if (body.includeTemplate === true) {
      const [row] = await sql`select encode(image_webp,'base64') as image from private.enl_org_templates where template_key='v1'`;
      if (!row) return reply({ok:false,message:'template_unavailable'},503);
      template = 'data:image/webp;base64,' + row.image.replace(/\s/g,'');
    }
    return reply({ok:true,period,site,history:result.history||[],document:result.document,template});
  }
  if (!field || site.active === false) return reply({ok:false,message:'forbidden'},403);
  const confirm = body.action === 'platform_org_confirm';
  if (!confirm && body.action !== 'platform_org_save') return reply({ok:false,message:'unknown_action'},400);
  const chart = confirm ? null : chartData(body.chart);
  if ((!confirm && !chart) || !Number.isInteger(body.revision) || body.revision < 0)
    return reply({ok:false,message:'invalid_chart'},400);
  return sql.begin(async (tx:any) => {
    // Serialize first insert as well as later revisions. Reject stale edits and checks.
    await tx`select pg_advisory_xact_lock(hashtextextended(${siteId}, 2911))`;
    const [currentSite] = await tx`select site_name from public.enl_site_master where site_id=${siteId} and active is not false for share`;
    if (!currentSite) return reply({ok:false,message:'site_unavailable'},409);
    const [last] = await tx`select revision, chart, period, confirmed from private.enl_org_charts where site_id=${siteId} order by revision desc limit 1`;
    if ((last?.revision ?? 0) !== body.revision || body.period !== halfYear() || body.period !== period)
      return reply({ok:false,message:'chart_changed'},409);
    if (confirm && !last) return reply({ok:false,message:'chart_required'},400);
    if (confirm && last.confirmed && last.period === period) return reply({ok:true,revision:last.revision});
    const revision = body.revision + 1;
    await tx`insert into private.enl_org_charts (site_id,revision,site_name,chart,period,confirmed,actor_id,actor_name)
      values (${siteId},${revision},${currentSite.site_name},${tx.json(confirm ? last.chart : chart)},${period},${confirm},${actor.id},${actor.name})`;
    return reply({ok:true,revision});
  });
}
