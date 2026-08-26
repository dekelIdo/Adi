import { ChangeDetectionStrategy, Component, ChangeDetectorRef, ElementRef, NgZone, OnInit, ViewChild, inject } from '@angular/core';
import { MediaService, Testimonial } from './media.service';

const MAX_BYTES = 12 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * The shape every published picture is exported at.
 *
 * The rail itself imposes no ratio: its cards take their size from the picture.
 * That is right for the three originals, which were chosen together, and wrong
 * for a stream of screenshots arriving one at a time over months, where every
 * new proportion changes the rhythm of the row. Fixing the export gives the rail
 * a consistent beat without the admin ever meeting the words "aspect ratio", and
 * 4:5 is the shape a phone screenshot crops into most naturally.
 */
const OUT_W = 1080;
const OUT_H = 1350;

/**
 * The private media screen: Adi picks a screenshot, frames it, publishes it.
 *
 * One component with its own styles, bootstrapped into its own entry point. It
 * is not part of the landing page's design system and must never be able to
 * reach it.
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
    <div class="shell" dir="rtl">
      @if (!ready) {
        <p class="note center">רגע…</p>
      } @else if (!configured) {
        <div class="panel">
          <h1>פרגונים</h1>
          <p class="note">הניהול עדיין לא מחובר.</p>
        </div>
      } @else if (!media.signedIn) {
        <form class="panel panel--gate" (submit)="signIn($event)">
          <h1>פרגונים</h1>
          <p class="note">כניסה לניהול התמונות</p>
          <label for="em">אימייל</label>
          <input id="em" type="email" autocomplete="username" required />
          <label for="pw">סיסמה</label>
          <input id="pw" type="password" autocomplete="current-password" required />
          @if (authError) { <p class="msg msg--bad">{{ authError }}</p> }
          <button type="submit" class="btn btn--primary" [disabled]="busy">
            {{ busy ? 'רגע…' : 'כניסה' }}
          </button>
        </form>
      } @else {
        <header class="topbar">
          <div>
            <h1>פרגונים</h1>
            <p class="note">{{ items.length }} תמונות באתר</p>
          </div>
          <button type="button" class="btn btn--quiet" (click)="signOut()">יציאה</button>
        </header>

        <section class="panel">
          @if (step === 'idle') {
            <h2>הוספת פרגון</h2>
            <p class="note">בוחרים צילום מסך, מסמנים מה יופיע, ומפרסמים.</p>
            <label class="drop">
              <input type="file" accept="image/jpeg,image/png,image/webp" (change)="pick($event)" />
              <span class="drop-plus">+</span>
              <span class="drop-main">בחירת צילום מסך</span>
              <span class="note">JPG, PNG או WebP · עד 12 מגה</span>
            </label>
            @if (pickError) { <p class="msg msg--bad">{{ pickError }}</p> }
            @if (notice) { <p class="msg msg--good">{{ notice }}</p> }
          }

          @if (step === 'crop') {
            <div class="steps"><span class="on">1 בחירה</span><span class="on">2 מסגור</span><span>3 פרסום</span></div>
            <h2>מה יופיע באתר</h2>
            <p class="note">גוררים את התמונה ומקרבים עד שרואים בדיוק את מה שרוצים. מה שבתוך המסגרת, זה מה שיופיע.</p>

            <div
              class="stage"
              #stage
              (pointerdown)="down($event)"
              (pointermove)="move($event)"
              (pointerup)="up($event)"
              (pointercancel)="up($event)"
            >
              <img class="stage-img" [src]="srcUrl" [style.transform]="frameTransform" alt="" draggable="false" />
              <div class="stage-mask" aria-hidden="true"></div>
            </div>

            <label class="zoom">
              <span class="note">קירוב</span>
              <input type="range" [min]="minZoom" max="3" step="0.01" [value]="zoom" (input)="setZoom($event)" />
            </label>

            <div class="row">
              <button type="button" class="btn btn--primary" (click)="toDetails()">אישור המסגור</button>
              <button type="button" class="btn btn--quiet" (click)="reset()">ביטול</button>
            </div>
          }

          @if (step === 'details') {
            <div class="steps"><span class="on">1 בחירה</span><span class="on">2 מסגור</span><span class="on">3 פרסום</span></div>
            <h2>פרסום</h2>
            <div class="confirm">
              <img class="confirm-img" [src]="croppedUrl" alt="תצוגה מקדימה" />
              <div class="confirm-side">
                <label for="ttl">שם (לא חובה)</label>
                <input id="ttl" type="text" maxlength="60" [value]="title" (input)="setTitle($event)" />
                <p class="note">כך התמונה תופיע בקרוסלה באתר.</p>
              </div>
            </div>

            @if (uploading) {
              <div class="track"><span [style.width.%]="progress"></span></div>
              <p class="note center">מעלה… {{ progress }}%</p>
            }
            @if (opError) { <p class="msg msg--bad">{{ opError }}</p> }

            <div class="row">
              <button type="button" class="btn btn--primary" (click)="publish()" [disabled]="uploading">
                {{ uploading ? 'מעלה…' : 'פרסום לאתר' }}
              </button>
              <button type="button" class="btn btn--quiet" (click)="backToCrop()" [disabled]="uploading">חזרה למסגור</button>
            </div>
          }
        </section>

        @if (loading) {
          <p class="note center">טוען…</p>
        } @else if (items.length === 0) {
          <div class="panel empty">
            <p class="note">עדיין אין תמונות. הראשונה שתעלי תופיע כאן ובאתר.</p>
          </div>
        } @else {
          <div class="grid">
            @for (item of items; track item.id; let i = $index) {
              <article class="tile">
                <img [src]="item.url" [alt]="item.title || 'פרגון'" loading="lazy" />
                <div class="tile-bar">
                  <strong>{{ item.title || 'ללא שם' }}</strong>
                  <div class="tile-acts">
                    <button type="button" class="icon" (click)="reorder(i, -1)" [disabled]="i === 0 || busy" aria-label="הקדמה">↑</button>
                    <button type="button" class="icon" (click)="reorder(i, 1)" [disabled]="i === items.length - 1 || busy" aria-label="איחור">↓</button>
                    <button type="button" class="icon icon--bad" (click)="remove(item)" [disabled]="busy" aria-label="מחיקה">✕</button>
                  </div>
                </div>
              </article>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      :host {
        --ink: #1a1816;
        --soft: #6b635b;
        --line: #e6e1db;
        --bg: #f4f1ed;
        --accent: #b3805a;
        display: block;
        min-height: 100vh;
        background: var(--bg);
        color: var(--ink);
        font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .shell { max-width: 640px; margin: 0 auto; padding: 24px 16px 80px; }
      h1 { font-size: 1.5rem; margin: 0; letter-spacing: -0.01em; }
      h2 { font-size: 1.1rem; margin: 0; letter-spacing: -0.01em; }
      .note { color: var(--soft); font-size: 0.9rem; margin: 0; line-height: 1.5; }
      .center { text-align: center; }

      .topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }

      .panel {
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 22px;
        margin-bottom: 18px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        box-shadow: 0 1px 2px rgba(26, 24, 22, 0.03), 0 12px 30px rgba(26, 24, 22, 0.04);
      }
      .panel--gate { margin-top: 12vh; }
      .empty { align-items: center; text-align: center; padding: 34px 22px; }

      label { font-size: 0.85rem; color: var(--soft); }
      input[type='email'], input[type='password'], input[type='text'] {
        font: inherit;
        padding: 13px 14px;
        border: 1px solid #ddd6cf;
        border-radius: 12px;
        background: #fff;
        color: var(--ink);
      }
      input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

      .btn {
        font: inherit;
        font-weight: 600;
        padding: 14px 20px;
        border-radius: 12px;
        border: 1px solid transparent;
        cursor: pointer;
        min-height: 50px;
      }
      .btn--primary { background: var(--ink); color: #fff; }
      .btn--quiet { background: #fff; color: var(--ink); border-color: #ddd6cf; }
      .btn[disabled] { opacity: 0.45; cursor: default; }
      .row { display: flex; gap: 10px; flex-wrap: wrap; }
      .row .btn { flex: 1 1 160px; }

      .drop {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 34px 20px;
        border: 1.5px dashed #d6cec6;
        border-radius: 16px;
        background: #fbfaf8;
        cursor: pointer;
        text-align: center;
      }
      .drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
      .drop-plus { font-size: 30px; line-height: 1; color: var(--accent); }
      .drop-main { font-weight: 600; color: var(--ink); }

      .steps { display: flex; gap: 8px; font-size: 0.78rem; color: var(--soft); }
      .steps span { padding: 5px 10px; border-radius: 999px; background: #f1ede8; }
      .steps .on { background: var(--ink); color: #fff; }

      .stage {
        position: relative;
        width: 100%;
        aspect-ratio: 4 / 5;
        overflow: hidden;
        border-radius: 14px;
        background: #efeae4;
        touch-action: none;
        cursor: grab;
        user-select: none;
      }
      .stage:active { cursor: grabbing; }
      .stage-img {
        position: absolute;
        left: 50%;
        top: 50%;
        transform-origin: center;
        will-change: transform;
        max-width: none;
      }
      .stage-mask {
        position: absolute;
        inset: 0;
        pointer-events: none;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.65), inset 0 0 0 2px rgba(26, 24, 22, 0.12);
        border-radius: 14px;
      }
      .zoom { display: flex; align-items: center; gap: 12px; }
      .zoom input { flex: 1; accent-color: #1a1816; }

      .confirm { display: flex; gap: 16px; align-items: flex-start; }
      .confirm-img { width: 46%; max-width: 210px; border-radius: 12px; border: 1px solid var(--line); display: block; }
      .confirm-side { flex: 1; display: flex; flex-direction: column; gap: 8px; }

      .track { height: 6px; background: #ece7e1; border-radius: 999px; overflow: hidden; }
      .track span { display: block; height: 100%; background: var(--ink); transition: width 120ms linear; }

      .msg { font-size: 0.88rem; margin: 0; }
      .msg--bad { color: #a3271f; }
      .msg--good { color: #2f6b46; }

      .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
      .tile {
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 16px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .tile img { display: block; width: 100%; height: auto; }
      .tile-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; }
      .tile-bar strong { font-size: 0.85rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tile-acts { display: flex; gap: 4px; }
      .icon {
        font: inherit;
        width: 34px;
        height: 34px;
        border-radius: 9px;
        border: 1px solid #ddd6cf;
        background: #fff;
        color: var(--ink);
        cursor: pointer;
      }
      .icon--bad { color: #a3271f; border-color: #e7c9c6; }
      .icon[disabled] { opacity: 0.4; cursor: default; }

      @media (max-width: 460px) {
        .confirm { flex-direction: column; }
        .confirm-img { width: 100%; max-width: none; }
        .grid { grid-template-columns: 1fr; }
      }
    `
  ]
})
export class AdminComponent implements OnInit {
  readonly media = inject(MediaService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  @ViewChild('stage') stageRef?: ElementRef<HTMLElement>;

  ready = false;
  configured = false;
  loading = false;
  busy = false;
  uploading = false;
  progress = 0;

  step: 'idle' | 'crop' | 'details' = 'idle';

  authError = '';
  pickError = '';
  opError = '';
  notice = '';
  title = '';

  items: Testimonial[] = [];

  srcUrl: string | null = null;
  croppedUrl: string | null = null;
  private source: HTMLImageElement | null = null;
  private cropped: Blob | null = null;

  zoom = 1;
  /** Smallest zoom that still shows the whole picture; set per image. */
  minZoom = 1;
  private tx = 0;
  private ty = 0;
  private baseW = 0;
  private baseH = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchStart = 0;
  private zoomStart = 1;

  /** The pan and zoom, as one transform the template binds directly. */
  get frameTransform(): string {
    return `translate(-50%, -50%) translate(${this.tx}px, ${this.ty}px) scale(${this.zoom})`;
  }

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
    this.reset();
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

  setTitle(e: Event): void {
    this.title = (e.target as HTMLInputElement).value;
  }

  backToCrop(): void {
    this.step = 'crop';
    this.cdr.markForCheck();
    requestAnimationFrame(() => this.sizeImage());
  }

  pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.reset();
    if (!file) return;

    if (!TYPES.includes(file.type)) {
      this.pickError = 'אפשר להעלות JPG, PNG או WebP בלבד.';
      input.value = '';
      this.cdr.markForCheck();
      return;
    }
    if (file.size > MAX_BYTES) {
      this.pickError = 'הקובץ גדול מדי. עד 12 מגה.';
      input.value = '';
      this.cdr.markForCheck();
      return;
    }

    const url = URL.createObjectURL(file);
    const probe = new Image();
    // Explicitly back inside the zone: an image load handler is not reliably
    // patched, and marking a view dirty only schedules it for the next pass.
    probe.onload = () =>
      this.zone.run(() => {
        this.source = probe;
        this.srcUrl = url;
        this.step = 'crop';
        this.cdr.markForCheck();
        // A FRAME, not a microtask. markForCheck only schedules the pass, and
        // microtasks drain before it runs, so this used to measure the crop
        // frame before it existed: it fell back to a guessed 360px width, never
        // sized the picture at all, and the export was computed against a frame
        // that was not the one on screen.
        requestAnimationFrame(() => this.fitToFrame());
      });
    probe.onerror = () =>
      this.zone.run(() => {
        URL.revokeObjectURL(url);
        this.pickError = 'לא הצלחנו לקרוא את התמונה.';
        this.cdr.markForCheck();
      });
    probe.src = url;
    input.value = '';
  }

  /** The frame's size in CSS pixels, which the export mapping is reversed from. */
  private frame(): { w: number; h: number } {
    const w = this.stageRef?.nativeElement.clientWidth || 360;
    return { w, h: w * (OUT_H / OUT_W) };
  }

  /**
   * Sizes the picture so it covers the frame at zoom 1 and centres it, which is
   * the sensible default for a screenshot: the middle is where the message is.
   */
  private fitToFrame(): void {
    if (!this.source) return;
    const { w: fw, h: fh } = this.frame();
    const nw = this.source.naturalWidth;
    const nh = this.source.naturalHeight;

    // Zoom 1 still means "fills the frame", because the export maths is written
    // against that baseline. What changes is how far below 1 the admin may go.
    const cover = Math.max(fw / nw, fh / nh);
    const contain = Math.min(fw / nw, fh / nh);
    this.baseW = nw * cover;
    this.baseH = nh * cover;

    // THE FLOOR IS THE PICTURE, NOT A CONSTANT. It used to be a hardcoded 1,
    // which is cover: on a phone screenshot at roughly 0.46 against a 0.8 frame
    // that meant barely half its height was reachable and there was no way to
    // zoom out, so a whole message could not be fitted no matter what was done.
    // The floor is now whatever it takes to see the entire image.
    this.minZoom = contain / cover;

    // And it opens there, showing the whole composition. The admin zooms in to
    // tighten rather than fighting their way out of a forced close-up.
    this.zoom = this.minZoom;
    this.tx = 0;
    this.ty = 0;
    this.sizeImage();
    this.cdr.markForCheck();
  }

  /**
   * The picture is laid out in CSS pixels so the transform only ever pans and
   * zooms. The export reverses exactly this mapping, which is why the two can
   * never disagree about what the frame is showing.
   */
  private sizeImage(): void {
    const el = this.stageRef?.nativeElement.querySelector('img') as HTMLImageElement | null;
    if (el && this.baseW) {
      el.style.width = `${this.baseW}px`;
      el.style.height = `${this.baseH}px`;
    }
  }

  down(e: PointerEvent): void {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      this.zoomStart = this.zoom;
      this.dragging = false;
      return;
    }
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  move(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 2 && this.pinchStart > 0) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.zoom = this.clampZoom((this.zoomStart * d) / this.pinchStart);
      this.clampPan();
      this.cdr.markForCheck();
      return;
    }
    if (!this.dragging) return;
    this.tx += e.clientX - this.lastX;
    this.ty += e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.clampPan();
    this.cdr.markForCheck();
  }

  up(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchStart = 0;
    if (this.pointers.size === 0) this.dragging = false;
  }

  setZoom(e: Event): void {
    this.zoom = this.clampZoom(parseFloat((e.target as HTMLInputElement).value));
    this.clampPan();
    this.cdr.markForCheck();
  }

  private clampZoom(z: number): number {
    return z < this.minZoom ? this.minZoom : z > 3 ? 3 : z;
  }

  /** Keeps the picture covering the frame, so a crop can never include a gap. */
  private clampPan(): void {
    const { w: fw, h: fh } = this.frame();
    const maxX = Math.max(0, (this.baseW * this.zoom - fw) / 2);
    const maxY = Math.max(0, (this.baseH * this.zoom - fh) / 2);
    this.tx = Math.min(maxX, Math.max(-maxX, this.tx));
    this.ty = Math.min(maxY, Math.max(-maxY, this.ty));
  }

  /**
   * Renders exactly what the frame is showing to a 1080x1350 canvas. The file
   * that reaches storage is the picture the admin framed, not the screenshot she
   * picked, so the carousel never has to compensate for what arrives.
   */
  async toDetails(): Promise<void> {
    if (!this.source) return;
    const { w: fw, h: fh } = this.frame();

    // Display pixels per natural pixel, then the reverse of the pan.
    const s = (this.baseW * this.zoom) / this.source.naturalWidth;
    const cx = this.source.naturalWidth / 2 - this.tx / s;
    const cy = this.source.naturalHeight / 2 - this.ty / s;
    const sw = fw / s;
    const sh = fh / s;

    const canvas = document.createElement('canvas');
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    // Zooming out far enough can leave the picture smaller than the frame in one
    // axis. Those margins are painted white rather than left transparent, so a
    // published testimonial is always a clean opaque card.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    ctx.drawImage(this.source, cx - sw / 2, cy - sh / 2, sw, sh, 0, 0, OUT_W, OUT_H);

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.9));
    if (!blob) {
      this.opError = 'לא הצלחנו להכין את התמונה.';
      this.cdr.markForCheck();
      return;
    }
    if (this.croppedUrl) URL.revokeObjectURL(this.croppedUrl);
    this.cropped = blob;
    this.croppedUrl = URL.createObjectURL(blob);
    this.step = 'details';
    this.cdr.markForCheck();
  }

  async publish(): Promise<void> {
    if (!this.cropped || this.uploading) return;   // also blocks a double tap
    this.uploading = true;
    this.progress = 0;
    this.opError = '';
    this.cdr.markForCheck();
    try {
      const row = await this.media.publish(this.cropped, this.title, OUT_W, OUT_H, (f) =>
        this.zone.run(() => {
          this.progress = Math.round(f * 100);
          this.cdr.markForCheck();
        })
      );
      this.items = [...this.items, row];
      this.reset();
      this.notice = 'התמונה פורסמה ומופיעה באתר.';
    } catch {
      this.opError = 'ההעלאה נכשלה. אפשר לנסות שוב.';
    } finally {
      this.uploading = false;
      this.cdr.markForCheck();
    }
  }

  reset(): void {
    if (this.srcUrl) URL.revokeObjectURL(this.srcUrl);
    if (this.croppedUrl) URL.revokeObjectURL(this.croppedUrl);
    this.srcUrl = null;
    this.croppedUrl = null;
    this.source = null;
    this.cropped = null;
    this.title = '';
    this.zoom = 1;
    this.tx = 0;
    this.ty = 0;
    this.pickError = '';
    this.progress = 0;
    this.step = 'idle';
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
   * tap; a swap touches exactly the two that changed.
   */
  async reorder(index: number, delta: number): Promise<void> {
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
