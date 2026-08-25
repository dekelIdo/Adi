import { ChangeDetectionStrategy, Component, ChangeDetectorRef, NgZone, OnInit, inject } from '@angular/core';
import { MediaService, Testimonial } from './media.service';

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * The private media screen. One job: let Adi change the pictures in the
 * testimonials rail from her phone, without touching the site.
 *
 * Deliberately one component with its own styles. It is not part of the landing
 * page's design system and must never be able to affect it.
 */
@Component({
  // The same host element the landing page uses. index.html ships a single
  // <app-root>, and only ever one of the two components is bootstrapped into
  // it, so there is no collision: main.ts picks the entry point before either
  // is constructed.
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap" dir="rtl">
      @if (!ready) {
        <p class="muted center">רגע…</p>
      } @else if (!configured) {
        <div class="card">
          <h1>פרגונים</h1>
          <p class="muted">הניהול עדיין לא מחובר. יש להשלים את קובץ ההגדרות לפני השימוש.</p>
        </div>
      } @else if (!media.signedIn) {
        <form class="card" (submit)="signIn($event)">
          <h1>פרגונים</h1>
          <label for="em">אימייל</label>
          <input id="em" #em type="email" autocomplete="username" required />
          <label for="pw">סיסמה</label>
          <input id="pw" #pw type="password" autocomplete="current-password" required />
          @if (authError) { <p class="error">{{ authError }}</p> }
          <button type="submit" [disabled]="busy">{{ busy ? 'רגע…' : 'כניסה' }}</button>
        </form>
      } @else {
        <header class="bar">
          <h1>פרגונים</h1>
          <button type="button" class="ghost" (click)="signOut()">יציאה</button>
        </header>

        <section class="card">
          <h2>הוספת תמונה</h2>
          <input
            #file
            type="file"
            accept="image/jpeg,image/png,image/webp"
            (change)="pick($event)"
          />
          @if (pickError) { <p class="error">{{ pickError }}</p> }

          @if (previewUrl) {
            <figure class="preview">
              <img [src]="previewUrl" alt="תצוגה מקדימה" />
              <figcaption class="muted" dir="ltr">{{ pendingW }}×{{ pendingH }}</figcaption>
            </figure>
            <label for="ttl">שם (לא חובה)</label>
            <input id="ttl" #ttl type="text" maxlength="60" />
            @if (uploading) {
              <div class="bar-track"><span [style.width.%]="progress"></span></div>
            }
            <div class="row">
              <button type="button" (click)="publish(ttl.value)" [disabled]="uploading">
                {{ uploading ? 'מעלה…' : 'פרסום' }}
              </button>
              <button type="button" class="ghost" (click)="clear()" [disabled]="uploading">ביטול</button>
            </div>
          }
          @if (notice) { <p class="ok">{{ notice }}</p> }
          @if (opError) { <p class="error">{{ opError }}</p> }
        </section>

        @if (loading) {
          <p class="muted center">טוען…</p>
        } @else {
          @for (item of items; track item.id; let i = $index) {
            <article class="card item">
              <img [src]="item.url" [alt]="item.title || 'פרגון'" loading="lazy" />
              <div class="meta">
                <strong>{{ item.title || 'ללא שם' }}</strong>
                <span class="muted">{{ item.published ? 'מפורסם' : 'לא מפורסם' }}</span>
              </div>
              <div class="row">
                <button type="button" class="ghost" (click)="move(i, -1)" [disabled]="i === 0 || busy">↑</button>
                <button type="button" class="ghost" (click)="move(i, 1)" [disabled]="i === items.length - 1 || busy">↓</button>
                <button type="button" class="danger" (click)="remove(item)" [disabled]="busy">מחיקה</button>
              </div>
            </article>
          } @empty {
            <p class="muted center">אין עדיין תמונות.</p>
          }
        }
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: #f6f4f1;
        color: #1a1816;
        font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
      }
      .wrap { max-width: 560px; margin: 0 auto; padding: 20px 16px 64px; }
      h1 { font-size: 1.4rem; margin: 0 0 14px; }
      h2 { font-size: 1.05rem; margin: 0 0 12px; }
      .bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
      .bar h1 { margin: 0; }
      .card {
        background: #fff;
        border: 1px solid #e6e1db;
        border-radius: 14px;
        padding: 16px;
        margin-bottom: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      label { font-size: 0.85rem; color: #6b635b; }
      input[type='email'], input[type='password'], input[type='text'] {
        font: inherit;
        padding: 11px 12px;
        border: 1px solid #ddd6cf;
        border-radius: 10px;
        background: #fff;
      }
      input[type='file'] { font: inherit; font-size: 0.9rem; }
      button {
        font: inherit;
        padding: 12px 16px;
        border-radius: 10px;
        border: 1px solid transparent;
        background: #1a1816;
        color: #fff;
        cursor: pointer;
        min-height: 44px;
      }
      button[disabled] { opacity: 0.5; cursor: default; }
      .ghost { background: #fff; color: #1a1816; border-color: #ddd6cf; }
      .danger { background: #fff; color: #a3271f; border-color: #e7c9c6; }
      .row { display: flex; gap: 8px; flex-wrap: wrap; }
      .row button { flex: 1 1 auto; }
      .preview img, .item img {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 10px;
        border: 1px solid #e6e1db;
      }
      .preview { margin: 0; }
      figcaption { font-size: 0.8rem; margin-top: 6px; }
      .meta { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
      .muted { color: #6b635b; font-size: 0.88rem; }
      .center { text-align: center; }
      .error { color: #a3271f; font-size: 0.88rem; margin: 0; }
      .ok { color: #2f6b46; font-size: 0.88rem; margin: 0; }
      .bar-track { height: 6px; background: #ece7e1; border-radius: 999px; overflow: hidden; }
      .bar-track span { display: block; height: 100%; background: #1a1816; transition: width 120ms linear; }
    `
  ]
})
export class AdminComponent implements OnInit {
  readonly media = inject(MediaService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  ready = false;
  configured = false;
  loading = false;
  busy = false;
  uploading = false;
  progress = 0;

  authError = '';
  pickError = '';
  opError = '';
  notice = '';

  items: Testimonial[] = [];

  previewUrl: string | null = null;
  private pending: File | null = null;
  pendingW = 0;
  pendingH = 0;

  async ngOnInit(): Promise<void> {
    this.configured = !!(await this.media.loadConfig());
    this.ready = true;
    if (this.configured && this.media.signedIn) await this.refresh();
    this.cdr.markForCheck();
  }

  async signIn(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy) return;
    const form = event.target as HTMLFormElement;
    const email = (form.querySelector('#em') as HTMLInputElement).value.trim();
    const password = (form.querySelector('#pw') as HTMLInputElement).value;
    this.authError = '';
    this.busy = true;
    this.cdr.markForCheck();
    try {
      await this.media.signIn(email, password);
      await this.refresh();
    } catch {
      this.authError = 'האימייל או הסיסמה שגויים.';
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  signOut(): void {
    this.media.signOut();
    this.items = [];
    this.clear();
    this.cdr.markForCheck();
  }

  private async refresh(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      this.items = await this.media.listAll();
    } catch {
      this.opError = 'לא הצלחנו לטעון את הרשימה.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Validation happens here rather than on publish, so an unusable file is
   * refused before Adi has waited for an upload. The dimensions are read from
   * the decoded image and travel with the record: the carousel needs them to
   * reserve space, and there is nowhere else to get them later.
   */
  pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.clear();
    if (!file) return;

    if (!TYPES.includes(file.type)) {
      this.pickError = 'אפשר להעלות JPG, PNG או WebP בלבד.';
      input.value = '';
      this.cdr.markForCheck();
      return;
    }
    if (file.size > MAX_BYTES) {
      this.pickError = 'הקובץ גדול מדי. עד 8 מגה.';
      input.value = '';
      this.cdr.markForCheck();
      return;
    }

    const url = URL.createObjectURL(file);
    // Explicitly back inside the zone. An image element's load handler is not
    // reliably patched, and marking a view dirty only schedules it for the next
    // change detection pass: without a pass to be part of, the preview never
    // appeared however correct the state was.
    const probe = new Image();
    probe.onload = () =>
      this.zone.run(() => {
        this.pending = file;
        this.previewUrl = url;
        this.pendingW = probe.naturalWidth;
        this.pendingH = probe.naturalHeight;
        this.cdr.markForCheck();
      });
    probe.onerror = () =>
      this.zone.run(() => {
        URL.revokeObjectURL(url);
        this.pickError = 'לא הצלחנו לקרוא את התמונה.';
        this.cdr.markForCheck();
      });
    probe.src = url;
  }

  async publish(title: string): Promise<void> {
    if (!this.pending || this.uploading) return;   // also blocks a double tap
    this.uploading = true;
    this.progress = 0;
    this.opError = '';
    this.notice = '';
    this.cdr.markForCheck();
    try {
      const row = await this.media.publish(this.pending, title, this.pendingW, this.pendingH, (f) =>
        this.zone.run(() => {
          this.progress = Math.round(f * 100);
          this.cdr.markForCheck();
        })
      );
      this.items = [...this.items, row];
      this.notice = 'התמונה פורסמה.';
      this.clear();
    } catch {
      this.opError = 'ההעלאה נכשלה. אפשר לנסות שוב.';
    } finally {
      this.uploading = false;
      this.cdr.markForCheck();
    }
  }

  clear(): void {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null;
    this.pending = null;
    this.pendingW = this.pendingH = 0;
    this.pickError = '';
    this.progress = 0;
    this.cdr.markForCheck();
  }

  async remove(item: Testimonial): Promise<void> {
    if (this.busy) return;
    if (!confirm('למחוק את התמונה?')) return;
    this.busy = true;
    this.opError = '';
    this.cdr.markForCheck();
    try {
      await this.media.remove(item);
      this.items = this.items.filter((r) => r.id !== item.id);
      this.notice = 'התמונה נמחקה.';
    } catch {
      this.opError = 'המחיקה נכשלה.';
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Swaps a pair. Reordering the whole list would rewrite every row on every
   * tap; a swap touches exactly the two that changed, and the list is already
   * sorted by the value being swapped.
   */
  async move(index: number, delta: number): Promise<void> {
    const target = index + delta;
    if (this.busy || target < 0 || target >= this.items.length) return;
    const a = this.items[index];
    const b = this.items[target];
    this.busy = true;
    this.opError = '';
    this.cdr.markForCheck();
    try {
      await this.media.setOrder([
        { id: a.id, sort_order: b.sort_order },
        { id: b.id, sort_order: a.sort_order }
      ]);
      const order = a.sort_order;
      a.sort_order = b.sort_order;
      b.sort_order = order;
      const next = [...this.items];
      next[index] = b;
      next[target] = a;
      this.items = next;
    } catch {
      this.opError = 'לא הצלחנו לשנות את הסדר.';
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
