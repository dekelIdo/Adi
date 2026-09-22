# Social-Li — Production, Email and Custom-Domain Cutover

This is the operating document for taking the site from its Render address to
the owner's custom domain, and for the contact-form email that must work on
both. It is written so that the owner does only what needs account access;
everything else is done in the repository and the deploy pipeline.

## Current production

| Item | Value |
| --- | --- |
| Public URL | https://adi-gnga.onrender.com/ |
| Host | Render **Static Site** (no server process; a CDN in front) |
| Repository | github.com/dekelIdo/Adi, branch `main` |
| Build | `npm ci` then `npm run build` (Angular production build) |
| Publish directory | `dist/landing-page/browser` |
| Deploys | Render auto-deploys `main` on push (see "Render checks" below) |
| Admin screen | `/admin` or `/#admin` (no router; a second entry point) |
| Lead storage | Supabase project `wrfagntltbiuyzsrywdb`, table `contact_leads` |

The application itself is hostname-independent: every asset path is relative,
Supabase and the social links are third-party origins, and there is no
analytics, CSP, redirect or environment file that names the host. The only
places that carry the public origin are the SEO files listed below, and they
are switched together by one script.

## Custom domain — pending

Not purchased / not supplied yet. Nothing in the repository refers to it, and
nothing will until it is real. When it is, the whole switch is the procedure in
"DNS cutover" below.

## Email configuration

### Architecture

```
visitor submits the form
  → POST {SUPABASE_URL}/functions/v1/send-lead          (browser, anon key only)
      → validates again, honeypot, rate limit
      → stores the lead in contact_leads               (service role, server side)
      → POST https://api.resend.com/emails             (RESEND_API_KEY, server side)
  ← 200 only when Resend accepted the message
  → the page shows "הפרטים התקבלו בהצלחה"
```

Source: `supabase/functions/send-lead/` (`handler.ts` is the logic, `index.ts`
the Edge runtime entry, `test.mjs` the Node test: `npm run test:send-lead`, needs Node 22.6+).

No secret exists in the browser bundle. The public site only ever holds the
Supabase URL and the anon (publishable) key, as before.

Until the function is deployed the site falls back to the direct table insert
it shipped with (the lead lands in the admin screen, no email). Every other
failure shows the Hebrew error and keeps the visitor's values in the fields.

### Function secrets (names only)

| Secret | Purpose | Set by |
| --- | --- | --- |
| `RESEND_API_KEY` | Resend API key | owner (Resend account) |
| `CONTACT_TO_EMAIL` | where leads are delivered; comma-separate for several | owner |
| `CONTACT_FROM_EMAIL` | sender identity; optional, defaults to `Social-Li <onboarding@resend.dev>` | owner, after domain verification |
| `ALLOWED_ORIGINS` | optional comma list restricting CORS; unset = any origin | optional |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | injected automatically by Supabase into every Edge Function | nobody |

### Before the custom domain: leads work now

Resend lets an account send from `onboarding@resend.dev` **to the account
owner's own email address** without verifying any domain. So if
`CONTACT_TO_EMAIL` is the same address the Resend account was created with,
leads arrive today. Sending to any other address, or from a branded address,
requires the domain step below.

### After the custom domain: branded sender

1. Resend → Domains → add the custom domain (or a subdomain such as
   `mail.example.com`, which keeps the root domain's DNS untouched).
2. Resend shows 2–3 DNS records (SPF/TXT, DKIM/CNAME or TXT, optional DMARC).
   Add them at the DNS provider.
3. Once Resend shows "Verified", set `CONTACT_FROM_EMAIL` to
   `Social-Li <leads@example.com>` and `CONTACT_TO_EMAIL` to any address.

### Deploying the function (once)

Dashboard path, no tools to install: Supabase → Edge Functions → Deploy a new
function → name `send-lead` → paste the contents of `handler.ts` and
`index.ts` (two files) → turn **off** "Verify JWT" → Deploy. Then Edge
Functions → Secrets → add the secrets above.

CLI path, from the repository root:

```
npx supabase login
npx supabase link --project-ref wrfagntltbiuyzsrywdb
npx supabase secrets set RESEND_API_KEY=... CONTACT_TO_EMAIL=...
npx supabase functions deploy send-lead
```

`supabase/config.toml` already sets `verify_jwt = false` for this function.

### Proving delivery

After deploy: submit the live form once with a real name and phone. Expected:
the page shows the success line, the email arrives at `CONTACT_TO_EMAIL`
with subject `ליד חדש מהאתר Social-Li: <name>`, and the lead appears in
`/admin` → leads. If the email does not arrive but the lead is in the admin,
the function answered 502 (`mail`): check the Resend key and the "to" rule
above.

## Render configuration

Verified from outside (response headers and build timing); the dashboard is
not accessible from the repository.

- Service type: Static Site behind Cloudflare, HSTS preload already on.
- Cache: `s-maxage=300` on HTML, so a deploy is visible within five minutes.
- SPA fallback: unknown paths return 404. The site needs none (single page;
  the admin uses `/#admin` when `/admin` is not rewritten).

**Render checks the owner should confirm once** (Settings of the static site):

- Build command `npm ci && npm run build`, publish directory
  `dist/landing-page/browser`, branch `main`, Auto-Deploy On (observed: the
  push of 2026-09-22 06:17 was live at 06:32, so allow about 15 minutes).

## Root / www strategy

Choose **one** canonical host when the domain is known. Default
recommendation: `https://www.example.com` canonical, apex `example.com`
redirecting to it (Render handles apex → www redirects with an ALIAS/ANAME or
A record, and issues certificates for both). If the registrar supports
ALIAS/ANAME at the apex, the reverse choice is equally fine. Whatever is
chosen, `set-public-origin.mjs` is run with that exact host.

## DNS cutover

### Claude does (repository + deploy)

1. `node scripts/set-public-origin.mjs https://www.example.com` — rewrites
   canonical, `og:url`, `og:image`, `twitter:image`, `robots.txt`,
   `sitemap.xml` and `site.config.json` together.
2. `npm run build` (the origin check refuses a mixed state), commit, push.
3. Prepare the exact DNS records for the owner's registrar from Render's
   "Custom Domains" instructions (Render shows them per domain).
4. After the owner's clicks: verify DNS propagation, Render certificate,
   root and www, live site, cinematics, Signing, form and email, SEO tags.

### OWNER ACTION REQUIRED

Only these need account access. Everything else is done for you.

1. **Render**: Static Site → Settings → Custom Domains → Add
   `www.example.com` and `example.com`. Copy the DNS values Render shows.
2. **DNS provider**: add those records (typically `CNAME www → <site>.onrender.com`
   and `A @ → 216.24.57.1`, or the ALIAS Render shows). Save.
3. **Resend** (for the branded sender): add the domain and paste the 2–3
   records Resend shows into the same DNS provider.
4. Reply with: `DOMAIN: example.com`, `DNS PROVIDER: <name>`, and the Resend
   account email (so `CONTACT_TO_EMAIL` can be set correctly).

Render issues and renews the HTTPS certificate itself once DNS resolves.

## HTTPS verification

`curl -sI https://www.example.com/` and `https://example.com/` must both
return 200 (or the apex a 301 to www) with a valid certificate; Render's
Custom Domains panel shows "Certificate issued".

## SEO switch

Handled entirely by `set-public-origin.mjs`. After deploy verify with
`curl -s https://www.example.com/ | grep -E 'canonical|og:url|og:image'`,
`/robots.txt` and `/sitemap.xml` (both must show the new host).

## Post-cutover QA

- Home renders at 390 and 1440; iPhone and MacBook cinematics scroll as on
  the Render host; Signing shows the real photograph and overlay.
- Contact form: one real submission, email received, lead in `/admin`.
- Old host `adi-gnga.onrender.com` still serves the site (do not disable it).
  Optionally, later, add a Render redirect rule from the old host to the new
  canonical, only after a week of healthy traffic on the new domain.

## Rollback

DNS-level: remove the custom domain records; the Render host keeps working
throughout because it is never turned off. Repository-level:
`node scripts/set-public-origin.mjs https://adi-gnga.onrender.com`, build,
push.

## WhatsApp (deferred)

The placeholder number lives in exactly one place:
`src/app/app.component.ts` → `socialLinks.whatsapp` (`https://wa.me/972000000000`).
Replace the digits with the real international number without `+` (for
`050-1234567` that is `972501234567`). The dock and every WhatsApp link read
from that one field. The admin screen builds `wa.me` links from each lead's
own phone and needs nothing.
