// Supabase Edge Function entry point. All logic lives in handler.ts so it can
// be tested under Node without the Deno runtime (see test.mjs).
import { handle } from './handler.ts';

Deno.serve((req) =>
  handle(req, {
    fetch: globalThis.fetch,
    now: () => new Date(),
    env: {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      RESEND_API_KEY: Deno.env.get('RESEND_API_KEY') ?? '',
      CONTACT_TO_EMAIL: Deno.env.get('CONTACT_TO_EMAIL') ?? '',
      CONTACT_FROM_EMAIL: Deno.env.get('CONTACT_FROM_EMAIL') ?? undefined,
      ALLOWED_ORIGINS: Deno.env.get('ALLOWED_ORIGINS') ?? undefined
    }
  })
);
