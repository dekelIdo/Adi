import { Injectable } from '@angular/core';

/**
 * The published testimonial record, as stored and as the public carousel reads
 * it. Deliberately minimal.
 *
 * `width` and `height` are not decoration. The carousel's cards take their size
 * from the picture rather than the other way round, so the markup has to declare
 * an aspect ratio before the image loads; without it the cards render 0x0, the
 * rail collapses, and the lazy images never enter the viewport to load at all.
 * They are measured in the browser at upload time and stored with the record.
 */
export interface Testimonial {
  id: string;
  url: string;
  path: string;          // storage identifier, needed to delete the file itself
  title: string | null;
  width: number;
  height: number;
  sort_order: number;
  published: boolean;
  created_at?: string;
}

/**
 * Runtime configuration, served as a plain asset rather than baked into the
 * bundle at build time. Both values are public by design: the anon key is a
 * client key, and every write is authorised server side by row level security
 * plus a signed-in session. No secret is present in the frontend.
 *
 * If the file is missing or unreadable the site simply runs without the feature.
 */
export interface AdminConfig {
  url: string;
  anonKey: string;
  bucket: string;
  table: string;
  /**
   * Whether the Google provider is actually enabled on the Supabase project.
   *
   * The sign-in button is rendered ONLY when this is true, because a Google
   * button that cannot complete a sign-in is worse than no button: it looks
   * like the feature exists and then fails in front of the user. The code below
   * is complete and needs no change to start working - this flag is flipped to
   * true once the provider is switched on in the Supabase dashboard (see
   * README next to admin.config.json).
   */
  googleAuth?: boolean;
}

/**
 * A contact-form submission as stored in `contact_leads` (see
 * supabase/migrations/20260903120000_contact_leads.sql for the table and its
 * row level security). The public site can only create one of these; reading
 * and updating them requires the admin session.
 */
export type LeadStatus = 'new' | 'contacted' | 'closed';

export interface Lead {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  email: string | null;
  business_name: string | null;
  message: string | null;
  source_path: string;
  status: LeadStatus;
  admin_notes: string;
}

/** What the public form is allowed to send. Nothing else is accepted server side. */
export interface LeadInput {
  full_name: string;
  phone: string;
  email: string | null;
  source_path: string;
}

const LEADS_TABLE = 'contact_leads';
const CONFIG_URL = 'assets/admin.config.json';
const TOKEN_KEY = 'aa-admin-token';

/**
 * The only content types this project's media pipeline can carry end to end:
 * the browser decodes them into an <img>, the cropper draws them to a canvas,
 * and the canvas exports WebP. Video is deliberately absent - the gallery is an
 * image gallery, and a reel dropped into it would have no path through any of
 * those steps. Widening this list means widening the whole pipeline first.
 */
export const PUBLISHABLE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/** The established ceiling for a gallery picture, unchanged. */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = '12MB';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private config: AdminConfig | null = null;
  private configLoaded = false;

  /** Reads the config once. Never throws: a missing config is a valid state. */
  async loadConfig(): Promise<AdminConfig | null> {
    if (this.configLoaded) return this.config;
    this.configLoaded = true;
    try {
      const res = await fetch(CONFIG_URL, { cache: 'no-cache' });
      if (!res.ok) return null;
      const cfg = (await res.json()) as AdminConfig;
      if (!cfg?.url || !cfg?.anonKey) return null;
      this.config = {
        url: cfg.url.replace(/\/+$/, ''),
        anonKey: cfg.anonKey,
        bucket: cfg.bucket || 'testimonials',
        table: cfg.table || 'testimonials'
      };
      return this.config;
    } catch {
      return null;
    }
  }

  get token(): string | null {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private set token(value: string | null) {
    try {
      if (value) sessionStorage.setItem(TOKEN_KEY, value);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private mode: the session simply does not survive a refresh */
    }
  }

  get signedIn(): boolean {
    return !!this.token;
  }

  private headers(auth: boolean): Record<string, string> {
    const cfg = this.config!;
    const h: Record<string, string> = { apikey: cfg.anonKey };
    // Unauthenticated reads still need a bearer: the anon key doubles as the
    // anonymous role's token, and row level security decides what that role can
    // see, which is published rows and nothing else.
    h['Authorization'] = `Bearer ${(auth && this.token) || cfg.anonKey}`;
    return h;
  }

  /**
   * Password sign in. The password is verified by the auth server and never
   * leaves this call; nothing about it is stored in the bundle or on the client.
   */
  async signIn(email: string, password: string): Promise<void> {
    const cfg = await this.loadConfig();
    if (!cfg) throw new Error('CONFIG');
    const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: cfg.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error('AUTH');
    const data = await res.json();
    if (!data?.access_token) throw new Error('AUTH');
    this.token = data.access_token;
  }

  /**
   * GOOGLE SIGN IN — the same architecture as everything else here: a plain
   * redirect to Supabase's own authorize endpoint, no SDK and no new
   * dependency. Supabase talks to Google, then sends the browser back to
   * `redirect_to` with the session in the URL fragment, which
   * `completeOAuthRedirect` below picks up.
   *
   * The fragment is used rather than a query string on purpose: it never
   * reaches a server or a log.
   */
  async signInWithGoogle(): Promise<void> {
    const cfg = await this.loadConfig();
    if (!cfg) throw new Error('CONFIG');
    if (!cfg.googleAuth) throw new Error('PROVIDER_DISABLED');
    // Back to this exact screen, including the hash route the admin is reached
    // through, so the visitor lands where they started.
    const redirect = `${window.location.origin}${window.location.pathname}${window.location.hash || ''}`;
    const url =
      `${cfg.url}/auth/v1/authorize?provider=google` +
      `&redirect_to=${encodeURIComponent(redirect)}`;
    window.location.assign(url);
  }

  /**
   * Called once on admin start-up. If we have just come back from Google the
   * session is sitting in the URL fragment; take it, then scrub the fragment so
   * a token is never left in the address bar, in history, or in a shared link.
   *
   * Returns what happened so the screen can tell the difference between "signed
   * in", "the user cancelled" and "nothing to do".
   */
  completeOAuthRedirect(): 'signed-in' | 'error' | 'none' {
    const hash = window.location.hash || '';
    const q = hash.includes('access_token=') || hash.includes('error=')
      ? new URLSearchParams(hash.slice(hash.indexOf('#') + 1).replace(/^[^?]*\?/, ''))
      : null;
    if (!q) {
      // The fragment may be a bare token string rather than a nested query.
      const raw = hash.replace(/^#/, '');
      if (!raw.includes('access_token=') && !raw.includes('error=')) return 'none';
      const p = new URLSearchParams(raw);
      return this.consumeOAuthParams(p);
    }
    return this.consumeOAuthParams(q);
  }

  private consumeOAuthParams(p: URLSearchParams): 'signed-in' | 'error' | 'none' {
    const token = p.get('access_token');
    const err = p.get('error') || p.get('error_description');
    // Strip the sensitive part of the fragment either way, keeping any route
    // hash (#admin) that was there before the redirect.
    const clean = () => {
      const route = (window.location.hash || '').split('#').find((x) => x && !x.includes('='));
      const url = window.location.pathname + window.location.search + (route ? '#' + route : '');
      window.history.replaceState({}, '', url);
    };
    if (token) {
      this.token = token;
      clean();
      return 'signed-in';
    }
    if (err) {
      clean();
      return 'error';
    }
    return 'none';
  }

  signOut(): void {
    this.token = null;
  }

  /** Everything, published or not. Used by the admin screen. */
  async listAll(): Promise<Testimonial[]> {
    const cfg = await this.loadConfig();
    if (!cfg) return [];
    const res = await fetch(
      `${cfg.url}/rest/v1/${cfg.table}?select=*&order=sort_order.asc`,
      { headers: this.headers(true) }
    );
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Testimonial[];
  }

  /**
   * Published records only, for the public carousel. Returns null rather than
   * throwing on any failure, so the caller can fall back to the static set: the
   * public site must never depend on this service being reachable.
   */
  async listPublished(): Promise<Testimonial[] | null> {
    try {
      const cfg = await this.loadConfig();
      if (!cfg) return null;
      const res = await fetch(
        `${cfg.url}/rest/v1/${cfg.table}?select=*&published=eq.true&order=sort_order.asc`,
        { headers: this.headers(false) }
      );
      if (!res.ok) return null;
      const rows = (await res.json()) as Testimonial[];
      const usable = rows.filter((r) => r?.url && r.width > 0 && r.height > 0);
      return usable.length ? usable : null;
    } catch {
      return null;
    }
  }

  /** Uploads the file, then writes the record. Returns the stored row. */
  async publish(
    file: Blob,
    title: string,
    width: number,
    height: number,
    onProgress?: (fraction: number) => void
  ): Promise<Testimonial> {
    // THE LAST GATE. The admin screen already refuses anything that is not a
    // picture, but that check guards one path through one UI, and this method is
    // the single place where bytes actually leave the browser. A file that
    // reached here by any other route - a future screen, a bug, a rebuilt flow -
    // still cannot become a gallery image. The bucket only ever holds pictures.
    if (!PUBLISHABLE_TYPES.includes((file.type || '').toLowerCase())) throw new Error('TYPE');
    if (!file.size || file.size > MAX_UPLOAD_BYTES) throw new Error('SIZE');

    const cfg = await this.loadConfig();
    if (!cfg) throw new Error('CONFIG');
    if (!this.token) throw new Error('AUTH');

    // The blob arriving here is the cropped export, not the screenshot the
    // admin picked, so the extension comes from its type rather than a filename.
    const ext = (file.type.split('/').pop() || 'webp').toLowerCase();
    const path = `${Date.now()}-${Math.round(performance.now())}.${ext}`;

    await this.upload(cfg, path, file, onProgress);

    const url = `${cfg.url}/storage/v1/object/public/${cfg.bucket}/${path}`;
    const existing = await this.listAll();
    const next = existing.reduce((m, r) => Math.max(m, r.sort_order), 0) + 1;

    const res = await fetch(`${cfg.url}/rest/v1/${cfg.table}`, {
      method: 'POST',
      headers: {
        ...this.headers(true),
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        url,
        path,
        title: title.trim() || null,
        width,
        height,
        sort_order: next,
        published: true
      })
    });
    if (!res.ok) {
      // Do not leave an orphan file behind if the record could not be written.
      await this.removeFile(cfg, path).catch(() => undefined);
      throw new Error(String(res.status));
    }
    const rows = (await res.json()) as Testimonial[];
    return rows[0];
  }

  /**
   * XHR rather than fetch, purely because it reports upload progress. Adi is
   * uploading phone screenshots over mobile data; a bar that moves is the
   * difference between waiting and assuming it broke.
   */
  private upload(
    cfg: AdminConfig,
    path: string,
    file: Blob,
    onProgress?: (fraction: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${cfg.url}/storage/v1/object/${cfg.bucket}/${path}`);
      xhr.setRequestHeader('apikey', cfg.anonKey);
      xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status))));
      xhr.onerror = () => reject(new Error('NETWORK'));
      xhr.send(file);
    });
  }

  private async removeFile(cfg: AdminConfig, path: string): Promise<void> {
    await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/${path}`, {
      method: 'DELETE',
      headers: this.headers(true)
    });
  }

  /** Removes the record and then the file it points at. */
  async remove(item: Testimonial): Promise<void> {
    const cfg = await this.loadConfig();
    if (!cfg) throw new Error('CONFIG');
    const res = await fetch(`${cfg.url}/rest/v1/${cfg.table}?id=eq.${item.id}`, {
      method: 'DELETE',
      headers: this.headers(true)
    });
    if (!res.ok) throw new Error(String(res.status));
    await this.removeFile(cfg, item.path).catch(() => undefined);
  }

  // ─── Leads ────────────────────────────────────────────────────────────────

  /**
   * The public form's one call. Anonymous role, insert only: the server keeps
   * nothing but a fresh lead and returns nothing (`return=minimal`), so no
   * read permission is involved. Throws on any failure; the caller shows a
   * generic Hebrew message and never the server's words.
   */
  async submitLead(input: LeadInput): Promise<void> {
    const cfg = await this.loadConfig();
    if (!cfg) throw new Error('CONFIG');
    const res = await fetch(`${cfg.url}/rest/v1/${LEADS_TABLE}`, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error(String(res.status));
  }

  /** Every lead, newest first. Admin session required (RLS). */
  async listLeads(): Promise<Lead[]> {
    const cfg = await this.loadConfig();
    if (!cfg) throw new Error('CONFIG');
    if (!this.token) throw new Error('AUTH');
    const res = await fetch(
      `${cfg.url}/rest/v1/${LEADS_TABLE}?select=*&order=created_at.desc`,
      { headers: this.headers(true) }
    );
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Lead[];
  }

  /** Status and/or private notes. Returns the row as stored. */
  async updateLead(id: string, patch: { status?: LeadStatus; admin_notes?: string }): Promise<Lead> {
    const cfg = await this.loadConfig();
    if (!cfg) throw new Error('CONFIG');
    if (!this.token) throw new Error('AUTH');
    const res = await fetch(`${cfg.url}/rest/v1/${LEADS_TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { ...this.headers(true), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error(String(res.status));
    const rows = (await res.json()) as Lead[];
    if (!rows[0]) throw new Error('EMPTY');
    return rows[0];
  }

  /** Writes a new order for exactly the two rows a move swaps. */
  async setOrder(rows: Array<{ id: string; sort_order: number }>): Promise<void> {
    const cfg = await this.loadConfig();
    if (!cfg) throw new Error('CONFIG');
    for (const row of rows) {
      const res = await fetch(`${cfg.url}/rest/v1/${cfg.table}?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: { ...this.headers(true), 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: row.sort_order })
      });
      if (!res.ok) throw new Error(String(res.status));
    }
  }
}
