/**
 * send-lead — the contact form's one server-side call.
 *
 * Pure request → response logic with no Deno globals, so the same code runs
 * inside the Supabase Edge runtime (see index.ts) and under plain Node for the
 * tests (see test.mjs). Everything the function needs from the outside world is
 * passed in through `deps`.
 *
 * WHAT IT DOES, IN ORDER
 *   1. CORS preflight / method check (POST only).
 *   2. Payload guard: JSON, at most MAX_BODY_BYTES, only the whitelisted fields.
 *   3. Honeypot: a filled `website` field is a bot → 200 with nothing done.
 *   4. Validation: the same rules the page applies, re-checked here.
 *   5. Rate limit: a global hourly cap and a per-phone repeat window, read from
 *      the contact_leads table with the service role.
 *   6. Store the lead in contact_leads (service role; RLS is bypassed on
 *      purpose, the checks above are the gate).
 *   7. Send the email through Resend. Only when Resend accepts the message
 *      does the caller get 200 — a stored-but-unmailed lead is a 502, so the
 *      page never shows success for an email that did not go out.
 *
 * SECRETS never reach the browser: RESEND_API_KEY and the service role key are
 * function secrets on the Supabase project.
 */

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
  /** Where the leads go. Required. */
  CONTACT_TO_EMAIL: string;
  /** Sender identity. Optional; defaults to Resend's shared onboarding sender. */
  CONTACT_FROM_EMAIL?: string;
  /** Comma-separated list of allowed origins. Optional; unset = any origin. */
  ALLOWED_ORIGINS?: string;
}

export interface Deps {
  env: Env;
  fetch: typeof fetch;
  now: () => Date;
}

export const MAX_BODY_BYTES = 4096;
export const HOURLY_CAP = 40;
export const REPEAT_WINDOW_MINUTES = 5;
export const DEFAULT_FROM = 'Social-Li <onboarding@resend.dev>';

const FIELDS = ['fullName', 'phone', 'email', 'website', 'sourcePath'] as const;

type Body = Partial<Record<(typeof FIELDS)[number], unknown>>;

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allow = allowed.length === 0 ? origin || '*' : allowed.includes(origin || '') ? origin! : allowed[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function json(status: number, body: unknown, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** The page's own rules, restated. Returns a field → message map; empty = valid. */
export function validate(input: { fullName: string; phone: string; email: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.fullName.length < 2 || input.fullName.length > 100) errors.fullName = 'name';
  const digits = input.phone.replace(/[\s\-().]/g, '');
  if (!/^(\+?972|0)\d{8,9}$/.test(digits) || input.phone.length > 20) errors.phone = 'phone';
  if (input.email && (input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email))) {
    errors.email = 'email';
  }
  return errors;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The message Adi receives. Hebrew, RTL, everything the visitor typed. */
export function buildEmail(lead: { fullName: string; phone: string; email: string; sourcePath: string }, at: Date) {
  const when = new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem'
  }).format(at);
  const waDigits = lead.phone.replace(/\D/g, '').replace(/^0/, '972');
  const subject = `ליד חדש מהאתר Social-Li: ${lead.fullName}`;
  const text = [
    'ליד חדש מטופס יצירת הקשר באתר Social-Li',
    '',
    `שם: ${lead.fullName}`,
    `טלפון: ${lead.phone}`,
    `מייל: ${lead.email || '—'}`,
    `נשלח: ${when}`,
    `מהעמוד: ${lead.sourcePath}`,
    '',
    `וואטסאפ: https://wa.me/${waDigits}`
  ].join('\n');
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;color:#6b6763;white-space:nowrap">${k}</td><td style="padding:6px 12px;color:#1a1816;font-weight:600">${v}</td></tr>`;
  const html =
    `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;background:#fcfbfa;font-family:Arial,Helvetica,sans-serif">` +
    `<div style="max-width:560px;margin:0 auto;padding:32px 24px;text-align:right">` +
    `<p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;color:#8a8580">SOCIAL-LI · ליד חדש מהאתר</p>` +
    `<h1 style="margin:0 0 20px;font-size:24px;color:#1a1816">${escapeHtml(lead.fullName)}</h1>` +
    `<table dir="rtl" style="border-collapse:collapse;font-size:16px">` +
    row('טלפון', `<a href="tel:${escapeHtml(lead.phone.replace(/[^\d+]/g, ''))}" style="color:#1a1816">${escapeHtml(lead.phone)}</a>`) +
    row('מייל', lead.email ? `<a href="mailto:${escapeHtml(lead.email)}" style="color:#1a1816">${escapeHtml(lead.email)}</a>` : '—') +
    row('נשלח', escapeHtml(when)) +
    row('מהעמוד', escapeHtml(lead.sourcePath)) +
    `</table>` +
    `<p style="margin:24px 0 0"><a href="https://wa.me/${waDigits}" style="display:inline-block;padding:12px 22px;background:#b9d6f2;color:#1a1816;text-decoration:none;border-radius:6px;font-weight:600">לפתוח וואטסאפ</a></p>` +
    `<p style="margin:28px 0 0;font-size:12px;color:#8a8580">הליד נשמר גם במסך הניהול של האתר.</p>` +
    `</div></body></html>`;
  return { subject, text, html };
}

async function countRecent(deps: Deps, filter: string): Promise<number> {
  const { env } = deps;
  const res = await deps.fetch(`${env.SUPABASE_URL}/rest/v1/contact_leads?select=id&${filter}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'count=exact',
      Range: '0-0'
    }
  });
  // "0-0/17" → 17. A failure to count must not block a real visitor.
  const range = res.headers.get('content-range') || '';
  const n = Number(range.split('/')[1]);
  return Number.isFinite(n) ? n : 0;
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const { env } = deps;
  const cors = corsHeaders(req.headers.get('origin'), env);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method' }, { ...cors, Allow: 'POST, OPTIONS' });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'size' }, cors);
  let body: Body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'json' }, cors);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'json' }, cors);
  if (Object.keys(body).some((k) => !(FIELDS as readonly string[]).includes(k))) {
    return json(400, { error: 'fields' }, cors);
  }

  // Honeypot: acknowledge, do nothing.
  if (str(body.website, 10)) return json(200, { ok: true }, cors);

  const lead = {
    fullName: str(body.fullName, 100),
    phone: str(body.phone, 20),
    email: str(body.email, 254),
    sourcePath: str(body.sourcePath, 200) || '/'
  };
  const errors = validate(lead);
  if (Object.keys(errors).length) return json(422, { error: 'validation', fields: errors }, cors);

  if (!env.CONTACT_TO_EMAIL || !env.RESEND_API_KEY) return json(503, { error: 'not-configured' }, cors);

  const now = deps.now();
  const hourAgo = new Date(now.getTime() - 3_600_000).toISOString();
  const repeatAgo = new Date(now.getTime() - REPEAT_WINDOW_MINUTES * 60_000).toISOString();
  const [hourly, repeats] = await Promise.all([
    countRecent(deps, `created_at=gte.${hourAgo}`),
    countRecent(deps, `created_at=gte.${repeatAgo}&phone=eq.${encodeURIComponent(lead.phone)}`)
  ]);
  if (hourly >= HOURLY_CAP || repeats > 0) return json(429, { error: 'rate' }, cors);

  // Store first: a lead is never lost because the mail provider hiccupped.
  const stored = await deps.fetch(`${env.SUPABASE_URL}/rest/v1/contact_leads`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      full_name: lead.fullName,
      phone: lead.phone,
      email: lead.email || null,
      source_path: lead.sourcePath
    })
  });
  if (!stored.ok) return json(502, { error: 'store' }, cors);

  const mail = buildEmail(lead, now);
  const sent = await deps.fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.CONTACT_FROM_EMAIL || DEFAULT_FROM,
      to: env.CONTACT_TO_EMAIL.split(',').map((s) => s.trim()).filter(Boolean),
      reply_to: lead.email || undefined,
      subject: mail.subject,
      text: mail.text,
      html: mail.html
    })
  });
  if (!sent.ok) return json(502, { error: 'mail' }, cors);

  return json(200, { ok: true }, cors);
}
