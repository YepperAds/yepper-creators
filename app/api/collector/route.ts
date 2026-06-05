import { query } from '../../_lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      site_key,
      visitor_id,
      url,
      referrer,
      user_agent,
      event_type = 'pageview',
      metadata = null,
      is_estimated = false,
    } = body || {};

    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').toString();

    await query(
      `INSERT INTO visits(site_key, visitor_id, page_url, referrer, user_agent, ip, event_type, metadata, is_estimated)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [site_key, visitor_id, url, referrer, user_agent, ip, event_type, metadata ? JSON.stringify(metadata) : null, is_estimated]
    );

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
}
