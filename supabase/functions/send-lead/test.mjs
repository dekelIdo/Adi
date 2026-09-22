// Runs the handler under Node with a fake Supabase and a fake Resend.
//   node --experimental-strip-types supabase/functions/send-lead/test.mjs
import assert from 'node:assert/strict';
import { handle, buildEmail, HOURLY_CAP } from './handler.ts';

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  RESEND_API_KEY: 're_test',
  CONTACT_TO_EMAIL: 'owner@example.com'
};

function makeDeps(overrides = {}) {
  const calls = [];
  const state = { hourly: 0, repeats: 0, storeOk: true, mailOk: true, ...overrides };
  const fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.startsWith('https://api.resend.com/')) {
      return new Response(state.mailOk ? '{"id":"m1"}' : '{"message":"nope"}', { status: state.mailOk ? 200 : 422 });
    }
    if (url.includes('/rest/v1/contact_leads')) {
      if ((init.method || 'GET') === 'POST') return new Response('', { status: state.storeOk ? 201 : 500 });
      const n = url.includes('phone=eq.') ? state.repeats : state.hourly;
      return new Response('', { status: 206, headers: { 'content-range': `0-0/${n}` } });
    }
    throw new Error('unexpected ' + url);
  };
  return { deps: { env: { ...env, ...(state.env || {}) }, fetch, now: () => new Date('2026-09-22T09:30:00Z') }, calls, state };
}

const post = (body, headers = {}) =>
  new Request('https://x/send-lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://adi-gnga.onrender.com', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });

const good = { fullName: 'דנה כהן', phone: '050-1234567', email: 'dana@example.com', sourcePath: '/' };

// 1. valid Hebrew submission → stored, mailed, 200, CORS reflected
{
  const { deps, calls } = makeDeps();
  const res = await handle(post(good), deps);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://adi-gnga.onrender.com');
  const store = calls.find((c) => c.init.method === 'POST' && c.url.includes('contact_leads'));
  assert.deepEqual(JSON.parse(store.init.body), { full_name: 'דנה כהן', phone: '050-1234567', email: 'dana@example.com', source_path: '/' });
  const mail = calls.find((c) => c.url.startsWith('https://api.resend.com'));
  const payload = JSON.parse(mail.init.body);
  assert.deepEqual(payload.to, ['owner@example.com']);
  assert.equal(payload.reply_to, 'dana@example.com');
  assert.match(payload.subject, /דנה כהן/);
  assert.match(payload.html, /dir="rtl"/);
  assert.match(payload.text, /050-1234567/);
  assert.match(payload.html, /wa\.me\/972501234567/);
  assert.equal(mail.init.headers.Authorization, 'Bearer re_test');
}

// 2. validation failure → 422, nothing stored or mailed
{
  const { deps, calls } = makeDeps();
  const res = await handle(post({ ...good, phone: '12' }), deps);
  assert.equal(res.status, 422);
  assert.deepEqual((await res.json()).fields, { phone: 'phone' });
  assert.equal(calls.length, 0);
}

// 3. provider failure → 502, lead stored, page must not show success
{
  const { deps } = makeDeps({ mailOk: false });
  const res = await handle(post(good), deps);
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, 'mail');
}

// 4. repeat within the window → 429; hourly cap → 429
{
  assert.equal((await handle(post(good), makeDeps({ repeats: 1 }).deps)).status, 429);
  assert.equal((await handle(post(good), makeDeps({ hourly: HOURLY_CAP }).deps)).status, 429);
}

// 5. honeypot → 200, nothing sent
{
  const { deps, calls } = makeDeps();
  const res = await handle(post({ ...good, website: 'http://spam' }), deps);
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
}

// 6. method, size, JSON and field whitelist guards
{
  const { deps } = makeDeps();
  assert.equal((await handle(new Request('https://x/send-lead', { method: 'GET' }), deps)).status, 405);
  assert.equal((await handle(new Request('https://x/send-lead', { method: 'OPTIONS' }), deps)).status, 204);
  assert.equal((await handle(post('x'.repeat(5000)), deps)).status, 413);
  assert.equal((await handle(post('{not json'), deps)).status, 400);
  assert.equal((await handle(post({ ...good, admin_notes: 'x' }), deps)).status, 400);
}

// 7. not configured → 503, nothing stored
{
  const { deps, calls } = makeDeps({ env: { CONTACT_TO_EMAIL: '' } });
  assert.equal((await handle(post(good), deps)).status, 503);
  assert.equal(calls.length, 0);
}

// 8. ALLOWED_ORIGINS restricts the reflected origin
{
  const { deps } = makeDeps({ env: { ALLOWED_ORIGINS: 'https://example.com, https://www.example.com' } });
  const res = await handle(post(good), deps);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://example.com');
  const ok = await handle(post(good, { origin: 'https://www.example.com' }), makeDeps({ env: { ALLOWED_ORIGINS: 'https://example.com,https://www.example.com' } }).deps);
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://www.example.com');
}

// 9. email content is UTF-8 Hebrew with the Jerusalem timestamp
{
  const m = buildEmail(good, new Date('2026-09-22T09:30:00Z'));
  assert.match(m.text, /נשלח: /);
  assert.match(m.text, /12:30/);
}

console.log('send-lead handler: 9 scenarios passed');
