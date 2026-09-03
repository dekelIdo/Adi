import { ChangeDetectionStrategy, Component, ChangeDetectorRef, ElementRef, NgZone, OnInit, ViewChild, inject } from '@angular/core';
import {
  MediaService,
  Testimonial,
  PUBLISHABLE_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL, Lead, LeadStatus } from './media.service';

/** Secondary sanity check on the name, after the content type has been read. */
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp'];

/**
 * What the admin is told when a file is turned away. Three sentences, no
 * technical vocabulary, and the same wording whether the file was a reel, a PDF
 * or something renamed to look like a picture: from where she is standing those
 * are one situation, and the answer to all of them is the same.
 */
const SAY_ONLY_IMAGES = 'ניתן להעלות תמונות בלבד — JPG, PNG או WEBP.';
const SAY_TOO_BIG = `הקובץ גדול מדי. יש לבחור תמונה עד ${MAX_UPLOAD_LABEL}.`;
const SAY_UNREADABLE = 'לא ניתן לקרוא את התמונה. נסי קובץ JPG, PNG או WEBP אחר.';

/**
 * Reads the first bytes and asks what the file actually is.
 *
 * The extension and the content type both come from the operating system's guess
 * about a filename, so a video renamed to .png arrives claiming to be an image
 * and passes every check that trusts what it says about itself. The signature at
 * the head of the file does not lie. This is what stops a reel from reaching the
 * cropper, which would otherwise be the first thing to actually look inside it.
 */
async function isRealImage(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (head.length < 12) return false;
  const at = (i: number, tag: string) => [...tag].every((ch, k) => head[i + k] === ch.charCodeAt(0));

  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true;            // JPEG
  if (head[0] === 0x89 && at(1, 'PNG')) return true;                                     // PNG
  if (at(0, 'RIFF') && at(8, 'WEBP')) return true;                                       // WebP
  return false;   // MP4/MOV (ftyp), WebM/MKV, GIF, PDF, SVG, HEIC, anything else
}

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
    <div class="shell" [class.shell--wide]="tab === 'leads'" dir="rtl">
      @if (!ready) {
        <p class="note center pad">רגע…</p>
      } @else if (!configured) {
        <div class="panel panel--gate">
          <p class="wordmark">עדי אריאלי</p>
          <h1>הסטודיו</h1>
          <p class="note">הניהול עדיין לא מחובר.</p>
        </div>
      } @else if (!media.signedIn) {
        <form class="panel panel--gate" (submit)="signIn($event)">
          <p class="wordmark">עדי אריאלי</p>
          <h1>הסטודיו</h1>
          <p class="note">הכניסה לניהול התוכן של האתר</p>
          <div class="field">
            <label for="em">אימייל</label>
            <input id="em" type="email" autocomplete="username" required />
          </div>
          <div class="field">
            <label for="pw">סיסמה</label>
            <input id="pw" type="password" autocomplete="current-password" required />
          </div>
          @if (authError) { <p class="msg msg--bad">{{ authError }}</p> }
          <button type="submit" class="btn btn--primary" [disabled]="busy">
            {{ busy ? 'רגע…' : 'כניסה' }}
          </button>

          <!-- GOOGLE. Rendered only when the provider is actually enabled on
               the Supabase project (admin.config.json -> googleAuth). A button
               that cannot finish a sign-in is worse than no button, so this one
               does not exist until the flow behind it works. -->
          @if (googleAvailable) {
            <div class="gate-or"><span>או</span></div>
            <button
              type="button"
              class="btn btn--google"
              [disabled]="busy"
              (click)="signInWithGoogle()"
            >
              <svg viewBox="0 0 18 18" aria-hidden="true" width="18" height="18">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
              </svg>
              <span>{{ busy ? 'רגע…' : 'המשך עם Google' }}</span>
            </button>
          }
        </form>
      } @else {
        <header class="masthead">
          <p class="wordmark">עדי אריאלי</p>
          <div class="masthead-row">
            <div>
              <h1>הסטודיו</h1>
              <p class="note">הפרגונים שמופיעים באתר · {{ items.length }} תמונות</p>
            </div>
            <button type="button" class="btn btn--quiet btn--sm" (click)="signOut()">יציאה</button>
          </div>
          <nav class="tabs" aria-label="אזורי הניהול">
            <button type="button" class="tab" [class.tab--on]="tab === 'media'" [attr.aria-current]="tab === 'media' ? 'page' : null" (click)="showTab('media')">תמונות</button>
            <button type="button" class="tab" [class.tab--on]="tab === 'leads'" [attr.aria-current]="tab === 'leads' ? 'page' : null" (click)="showTab('leads')">
              פניות
              @if (newLeadCount > 0) { <span class="pill">{{ newLeadCount }}</span> }
            </button>
          </nav>
        </header>

        @if (tab === 'leads') {
          <section class="leads" aria-labelledby="leads-title">
            <div class="head head--rule">
              <p class="eyebrow">פניות</p>
              <h2 id="leads-title">מי השאיר פרטים באתר</h2>
              <p class="note">{{ newLeadCount }} חדשות · {{ leads.length }} סך הכול</p>
            </div>

            <div class="leads-tools">
              <div class="chips" role="group" aria-label="סינון לפי סטטוס">
                @for (f of leadFilters; track f.value) {
                  <button type="button" class="chip" [class.chip--on]="leadFilter === f.value" [attr.aria-pressed]="leadFilter === f.value" (click)="setLeadFilter(f.value)">
                    {{ f.label }} <span class="chip-n">{{ countFor(f.value) }}</span>
                  </button>
                }
              </div>
              <div class="row-end">
                <button type="button" class="btn btn--quiet btn--sm" (click)="refreshLeads()" [disabled]="leadsLoading">רענון</button>
                <button type="button" class="btn btn--quiet btn--sm" (click)="exportLeadsCsv()" [disabled]="leads.length === 0">ייצוא פניות ל־CSV</button>
              </div>
            </div>

            @if (leadsLoading) {
              <p class="note center pad">טוענת פניות…</p>
            } @else if (leadsError) {
              <p class="msg msg--bad">{{ leadsError }}</p>
              <div class="row"><button type="button" class="btn btn--quiet btn--sm" (click)="refreshLeads()">נסי שוב</button></div>
            } @else if (visibleLeads.length === 0) {
              <div class="panel empty">
                <p class="note">{{ leads.length === 0 ? 'עדיין אין פניות. ברגע שמישהו ישאיר פרטים באתר, זה יופיע כאן.' : 'אין פניות בסינון הזה.' }}</p>
              </div>
            } @else {
              @if (leadOpError) { <p class="msg msg--bad">{{ leadOpError }}</p> }
              <div class="leads-head" aria-hidden="true">
                <span>מתי · מי</span><span>יצירת קשר</span><span>סטטוס · הערות</span>
              </div>
              <div class="leads-list">
                @for (lead of visibleLeads; track lead.id) {
                  <article class="lead" [class.lead--new]="lead.status === 'new'">
                    <div class="lead-who">
                      <p class="lead-when">{{ formatWhen(lead.created_at) }}</p>
                      <h3 class="lead-name">{{ lead.full_name }}</h3>
                      @if (lead.business_name) { <p class="lead-meta">{{ lead.business_name }}</p> }
                      @if (lead.message) { <p class="lead-msg">{{ lead.message }}</p> }
                    </div>
                    <div class="lead-links">
                      <a class="lead-link" [href]="'tel:' + telHref(lead.phone)" dir="ltr">{{ lead.phone }}</a>
                      <a class="lead-link" [href]="waHref(lead.phone)" target="_blank" rel="noopener noreferrer">WhatsApp</a>
                      @if (lead.email) { <a class="lead-link" [href]="'mailto:' + lead.email" dir="ltr">{{ lead.email }}</a> }
                    </div>
                    <div class="lead-side">
                      <label class="lead-field">
                        <span>סטטוס</span>
                        <select [value]="lead.status" (change)="setLeadStatus(lead, $event)" [disabled]="leadBusy === lead.id">
                          <option value="new">חדשה</option>
                          <option value="contacted">נוצר קשר</option>
                          <option value="closed">סגורה</option>
                        </select>
                      </label>
                      <label class="lead-field">
                        <span>הערות פנימיות</span>
                        <textarea rows="2" maxlength="4000" [value]="noteFor(lead)" (input)="draftNote(lead, $event)" [disabled]="leadBusy === lead.id"></textarea>
                      </label>
                      <div class="lead-save">
                        <button type="button" class="btn btn--quiet btn--sm" (click)="saveNote(lead)" [disabled]="leadBusy === lead.id || !noteDirty(lead)">
                          {{ leadBusy === lead.id ? 'שומרת…' : 'שמירת הערה' }}
                        </button>
                        @if (savedNoteId === lead.id) { <span class="lead-saved" role="status">נשמר ✓</span> }
                      </div>
                    </div>
                  </article>
                }
              </div>
            }
          </section>
        } @else {

        <section class="panel">
          @if (step === 'idle') {
            <div class="head">
              <p class="eyebrow">מדיה</p>
              <h2>הוספת תמונה לגלריה</h2>
              <p class="note">בוחרים צילום מסך, מסמנים מה יופיע, ומפרסמים לאתר.</p>
            </div>
            <label class="drop">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                (change)="pick($event)"
              />
              <span class="drop-mark" aria-hidden="true"></span>
              <span class="drop-main">בחירת תמונה מהמכשיר</span>
              <span class="drop-formats">JPG · PNG · WEBP</span>
              <span class="drop-limit">עד {{ sizeLabel }}</span>
            </label>
            @if (pickError) { <p class="msg msg--bad">{{ pickError }}</p> }
            @if (notice) { <p class="msg msg--good">{{ notice }}</p> }
          }

          @if (step === 'crop') {
            <div class="steps"><span class="on">בחירה</span><span class="on">מסגור</span><span>פרסום</span></div>
            <div class="head">
              <p class="eyebrow">מסגור</p>
              <h2>מה יופיע באתר</h2>
              <p class="note">גוררים את התמונה ומקרבים עד שרואים בדיוק את מה שרוצים. מה שבתוך המסגרת, זה מה שיופיע.</p>
            </div>

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
              <span class="zoom-label">קירוב</span>
              <input type="range" [min]="minZoom" max="3" step="0.01" [value]="zoom" (input)="setZoom($event)" />
            </label>

            <div class="row">
              <button type="button" class="btn btn--primary" (click)="toDetails()">אישור המסגור</button>
              <button type="button" class="btn btn--quiet" (click)="reset()">ביטול</button>
            </div>
          }

          @if (step === 'details') {
            <div class="steps"><span class="on">בחירה</span><span class="on">מסגור</span><span class="on">פרסום</span></div>
            <div class="head">
              <p class="eyebrow">פרסום</p>
              <h2>כך זה ייראה באתר</h2>
            </div>
            <div class="confirm">
              <img class="confirm-img" [src]="croppedUrl" alt="תצוגה מקדימה" />
              <div class="confirm-side">
                <div class="field">
                  <label for="ttl">שם התמונה <span class="opt">לא חובה</span></label>
                  <input id="ttl" type="text" maxlength="60" [value]="title" (input)="setTitle($event)" />
                </div>
                <p class="note">השם מופיע רק כאן, כדי שיהיה קל למצוא אותה אחר כך.</p>
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

        <section class="gallery">
          <div class="head head--rule">
            <p class="eyebrow">הגלריה</p>
            <h2>מה מופיע באתר עכשיו</h2>
          </div>

          @if (loading) {
            <p class="note center pad">טוען…</p>
          } @else if (items.length === 0) {
            <div class="panel empty">
              <p class="note">עדיין אין תמונות. הראשונה שתעלי תופיע כאן ובאתר.</p>
            </div>
          } @else {
            @if (opError && step !== 'details') { <p class="msg msg--bad">{{ opError }}</p> }
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
        </section>
        }
      }
    </div>
  `,
  styles: [
    `
    /* GOOGLE. Google's brand guidance: their mark, unaltered, on a neutral
       surface with a clear border - never recoloured and never placed inside a
       coloured pill. It sits quieter than the primary control because email is
       still the main route in. */
    .gate-or {
      display: flex; align-items: center; gap: 10px;
      margin: 14px 0 12px; color: var(--ink-3, #8a8480); font-size: 0.78rem;
    }
    .gate-or::before, .gate-or::after {
      content: ""; flex: 1; height: 1px; background: rgba(0,0,0,.10);
    }
    .btn--google {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      width: 100%; min-height: 44px;
      background: #fff; color: #3c4043;
      border: 1px solid rgba(0,0,0,.16); border-radius: 6px;
      font-weight: 600; cursor: pointer;
      transition: background-color 200ms ease, border-color 200ms ease;
    }
    .btn--google:hover:not(:disabled) { background: #f7f7f7; border-color: rgba(0,0,0,.26); }
    .btn--google:disabled { opacity: .6; cursor: default; }
    .btn--google svg { flex: none; }

      /* THE PRIVATE SIDE OF THE SAME BRAND.
       *
       * This screen is not part of the landing page design system and cannot
       * reach it, but it is not a different brand either: it borrows the public
       * site two typefaces, its warm off-white paper and its airy blue, and it
       * spends them the same way - a lot of space, a hairline instead of a box,
       * one weight of emphasis at a time. What it deliberately does not borrow is
       * the vocabulary of a dashboard. There are no metrics, no chrome, no icons
       * standing in for words, and nothing on screen that Adi did not put there
       * herself. It should read as her studio, not as the back of the website.
       */
      :host {
        --ink: #2a2826;
        --soft: #6f6862;
        --faint: #a29a92;
        --line: #eae5df;
        --hair: #f1ece6;
        --paper: #fffdfb;
        --accent: #bbddfa;
        --accent-deep: #6d97bb;
        --good: #3d6b52;
        --bad: #9c3b32;

        display: block;
        min-height: 100vh;
        /* An airy wash at the head of the page falling into warm neutral: the
         * public site two atmospheres, in the order it uses them. */
        background: radial-gradient(128% 62% at 50% 0%, #eef4fa 0%, #f8f5f1 56%, #f6f2ee 100%);
        background-repeat: no-repeat;
        color: var(--ink);
        font-family: "Assistant", Arial, Helvetica, sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      .shell {
        max-width: 620px;
        margin: 0 auto;
        padding: clamp(28px, 6vw, 52px) clamp(16px, 5vw, 24px) 96px;
      }

      /* Yarden is the display face on the public site and it carries almost no
       * Latin, so it is used here exactly where it is used there: Hebrew titles,
       * nothing else. */
      h1,
      h2 {
        font-family: "Yarden", "Assistant", Arial, sans-serif;
        font-weight: 400;
        letter-spacing: -0.02em;
        line-height: 1.1;
        margin: 0;
      }
      h1 { font-size: clamp(1.9rem, 7vw, 2.5rem); }
      h2 { font-size: clamp(1.35rem, 5vw, 1.6rem); }

      .note { color: var(--soft); font-size: 0.94rem; margin: 0; line-height: 1.6; }
      .center { text-align: center; }
      .pad { padding: 40px 0; }

      /* The eyebrow is the one piece of type that repeats: it names the part of
       * the studio you are standing in, so the sections read as rooms rather
       * than as a stack of unrelated forms. */
      .eyebrow {
        font-size: 0.68rem;
        font-weight: 600;
        letter-spacing: 0.22em;
        color: var(--accent-deep);
        margin: 0;
      }

      .wordmark {
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.26em;
        color: var(--faint);
        margin: 0;
      }

      .masthead { margin-bottom: clamp(26px, 6vw, 40px); }
      .masthead .wordmark { margin-bottom: 14px; }
      .masthead-row {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        padding-bottom: 18px;
        border-bottom: 1px solid var(--line);
      }
      .masthead h1 { margin-bottom: 6px; }

      .head { display: flex; flex-direction: column; gap: 7px; }
      .head--rule { padding-bottom: 14px; border-bottom: 1px solid var(--line); margin-bottom: 18px; }

      .panel {
        background: var(--paper);
        border: 1px solid var(--hair);
        border-radius: 22px;
        padding: clamp(20px, 5vw, 30px);
        display: flex;
        flex-direction: column;
        gap: 18px;
        /* One shadow, almost invisible: the card is meant to sit on the paper,
         * not float above it. */
        box-shadow: 0 1px 2px rgba(42, 40, 38, 0.02), 0 18px 44px rgba(42, 40, 38, 0.045);
      }
      .panel--gate { margin-top: 12vh; text-align: center; align-items: stretch; }
      .panel--gate .btn { margin-top: 4px; }
      .empty { align-items: center; text-align: center; padding: 40px 24px; }

      .gallery { margin-top: clamp(30px, 7vw, 46px); }

      .field { display: flex; flex-direction: column; gap: 7px; text-align: start; }
      label {
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: var(--soft);
      }
      .opt { font-weight: 400; color: var(--faint); }

      input[type='email'],
      input[type='password'],
      input[type='text'] {
        font: inherit;
        width: 100%;
        min-height: 52px;
        padding: 14px 16px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: #fff;
        color: var(--ink);
        transition: border-color 200ms ease, box-shadow 200ms ease;
      }
      input[type='email']:focus,
      input[type='password']:focus,
      input[type='text']:focus {
        outline: none;
        border-color: var(--accent-deep);
        box-shadow: 0 0 0 3px rgba(187, 221, 250, 0.4);
      }

      /* Confident rather than loud: one solid ink button, one hairline button,
       * both generous enough to hit with a thumb. */
      .btn {
        font: inherit;
        font-weight: 600;
        letter-spacing: 0.01em;
        padding: 15px 26px;
        border-radius: 999px;
        border: 1px solid transparent;
        cursor: pointer;
        min-height: 54px;
        transition: background-color 220ms ease, color 220ms ease, border-color 220ms ease;
      }
      .btn--primary { background: var(--ink); color: #fffdfb; }
      .btn--primary:hover { background: #3a3733; }
      .btn--quiet { background: #fff; color: var(--ink); border-color: var(--line); }
      .btn--quiet:hover { border-color: var(--accent-deep); color: var(--accent-deep); }
      .btn--sm { min-height: 44px; padding: 10px 20px; font-size: 0.88rem; }
      .btn[disabled] { opacity: 0.4; cursor: default; }
      .row { display: flex; gap: 10px; flex-wrap: wrap; }
      .row .btn { flex: 1 1 170px; }

      /* THE UPLOAD AREA CARRIES ITS OWN INSTRUCTIONS.
       * What it accepts and how large it may be are printed inside it, in that
       * order, before anything is chosen - so the answer to "what can I put
       * here" is on screen rather than in an error message afterwards. */
      .drop {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: clamp(34px, 9vw, 46px) 24px;
        border: 1px dashed #ddd5cc;
        border-radius: 18px;
        background: linear-gradient(180deg, #fbfdff 0%, #fdfbf9 100%);
        cursor: pointer;
        text-align: center;
        transition: border-color 240ms ease, background-color 240ms ease;
      }
      .drop:hover,
      .drop:focus-within { border-color: var(--accent-deep); background: #fbfdff; }
      .drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
      .drop-mark {
        width: 54px;
        height: 54px;
        margin-bottom: 12px;
        border-radius: 50%;
        background: var(--accent);
        position: relative;
        flex: none;
      }
      .drop-mark::before,
      .drop-mark::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        background: #fff;
        border-radius: 2px;
        transform: translate(-50%, -50%);
      }
      .drop-mark::before { width: 18px; height: 1.5px; }
      .drop-mark::after { width: 1.5px; height: 18px; }
      .drop-main { font-weight: 600; font-size: 1.05rem; color: var(--ink); }
      .drop-formats {
        font-size: 0.74rem;
        font-weight: 600;
        letter-spacing: 0.18em;
        color: var(--faint);
        margin-top: 6px;
      }
      .drop-limit { font-size: 0.84rem; color: var(--faint); }

      .steps { display: flex; gap: 7px; font-size: 0.74rem; letter-spacing: 0.06em; }
      .steps span {
        padding: 6px 13px;
        border-radius: 999px;
        background: #f3efea;
        color: var(--faint);
      }
      .steps .on { background: var(--ink); color: #fffdfb; }

      .stage {
        position: relative;
        width: 100%;
        aspect-ratio: 4 / 5;
        overflow: hidden;
        border-radius: 16px;
        background: #f1ece6;
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
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.7), inset 0 0 0 2px rgba(42, 40, 38, 0.1);
        border-radius: 16px;
      }

      .zoom { display: flex; align-items: center; gap: 14px; }
      .zoom-label { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.04em; color: var(--soft); }
      .zoom input { flex: 1; accent-color: var(--ink); height: 30px; }

      .confirm { display: flex; gap: 18px; align-items: flex-start; }
      .confirm-img {
        width: 46%;
        max-width: 210px;
        border-radius: 14px;
        border: 1px solid var(--line);
        display: block;
      }
      .confirm-side { flex: 1; display: flex; flex-direction: column; gap: 10px; }

      .track { height: 5px; background: #eee9e3; border-radius: 999px; overflow: hidden; }
      .track span { display: block; height: 100%; background: var(--ink); transition: width 120ms linear; }

      /* Feedback reads as a sentence in the page, not as an alert bar pasted over
       * it. The mark before the text carries the tone so the colour does not have
       * to shout. */
      .msg {
        display: flex;
        align-items: flex-start;
        gap: 9px;
        font-size: 0.92rem;
        line-height: 1.55;
        margin: 0;
        padding: 13px 16px;
        border-radius: 14px;
      }
      .msg::before { font-weight: 700; line-height: 1.55; }
      .msg--bad { color: var(--bad); background: #fdf4f3; }
      .msg--bad::before { content: "!"; }
      .msg--good { color: var(--good); background: #f2f8f4; }
      .msg--good::before { content: "\u2713"; }

      .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
      .tile {
        background: var(--paper);
        border: 1px solid var(--hair);
        border-radius: 18px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 1px 2px rgba(42, 40, 38, 0.02), 0 12px 30px rgba(42, 40, 38, 0.04);
      }
      .tile img { display: block; width: 100%; height: auto; }
      .tile-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 11px 13px;
      }
      .tile-bar strong {
        font-size: 0.86rem;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tile-acts { display: flex; gap: 5px; }
      .icon {
        font: inherit;
        font-size: 0.9rem;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: 1px solid var(--line);
        background: #fff;
        color: var(--soft);
        cursor: pointer;
        transition: border-color 200ms ease, color 200ms ease;
      }
      .icon:hover { border-color: var(--accent-deep); color: var(--accent-deep); }
      .icon--bad { color: var(--bad); border-color: #eed7d4; }
      .icon--bad:hover { border-color: var(--bad); color: var(--bad); }
      .icon[disabled] { opacity: 0.35; cursor: default; }

      /* Mobile is not the desktop screen made smaller: the preview stacks, the
       * gallery goes to one column so a published picture is still large enough
       * to judge, and every control keeps a comfortable target. */
      @media (max-width: 480px) {
        .confirm { flex-direction: column; }
        .confirm-img { width: 100%; max-width: none; }
        .grid { grid-template-columns: 1fr; }
        .row .btn { flex: 1 1 100%; }
        .masthead-row { align-items: center; }
      }

      /* ─── Leads ─────────────────────────────────────────────────────── */
      .shell--wide { max-width: 980px; }
      .tabs { display: flex; gap: 6px; margin-top: 18px; border-bottom: 1px solid var(--line); }
      .tab {
        font: inherit; font-weight: 600; font-size: 0.95rem; color: var(--soft);
        background: none; border: 0; border-bottom: 2px solid transparent;
        padding: 10px 14px; margin-bottom: -1px; cursor: pointer;
        display: inline-flex; align-items: center; gap: 8px;
      }
      .tab--on { color: var(--ink); border-bottom-color: var(--ink); }
      .tab:focus-visible { outline: 2px solid var(--accent-deep); outline-offset: 2px; border-radius: 6px; }
      .pill { min-width: 22px; padding: 1px 7px; border-radius: 999px; background: var(--ink); color: #fffdfb; font-size: 0.78rem; text-align: center; }
      .leads { margin-top: 26px; }
      .leads-tools { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin: 14px 0 16px; }
      .chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .chip {
        font: inherit; font-size: 0.88rem; font-weight: 600; color: var(--ink);
        background: #fff; border: 1px solid var(--line); border-radius: 999px;
        padding: 8px 14px; cursor: pointer; min-height: 40px;
      }
      .chip--on { background: var(--ink); color: #fffdfb; border-color: var(--ink); }
      .chip:focus-visible { outline: 2px solid var(--accent-deep); outline-offset: 2px; }
      .chip-n { opacity: 0.7; margin-inline-start: 4px; }
      .row-end { display: flex; gap: 8px; flex-wrap: wrap; }
      .leads-head { display: none; }
      .leads-list { display: flex; flex-direction: column; gap: 12px; }
      .lead {
        background: #fff; border: 1px solid var(--line); border-radius: 16px;
        padding: 16px; display: grid; gap: 14px;
        border-inline-start: 4px solid transparent;
      }
      .lead--new { border-inline-start-color: var(--accent-deep); }
      .lead-when { margin: 0 0 4px; font-size: 0.8rem; color: var(--faint); }
      .lead-name { margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--ink); }
      .lead-meta { margin: 6px 0 0; font-size: 0.9rem; color: var(--soft); }
      .lead-msg { margin: 8px 0 0; font-size: 0.92rem; line-height: 1.55; color: var(--ink); white-space: pre-wrap; }
      .lead-links { display: flex; flex-wrap: wrap; gap: 8px 14px; align-content: start; }
      .lead-link { color: var(--accent-deep); font-weight: 600; text-decoration: none; padding: 6px 0; min-height: 36px; display: inline-flex; align-items: center; }
      .lead-link:hover, .lead-link:focus-visible { text-decoration: underline; }
      .lead-side { display: grid; gap: 10px; }
      .lead-field { display: grid; gap: 6px; }
      .lead-field span { font-size: 0.78rem; font-weight: 600; color: var(--soft); }
      .lead-field select, .lead-field textarea {
        font: inherit; width: 100%; padding: 10px 12px; border: 1px solid var(--line);
        border-radius: 12px; background: #fff; color: var(--ink); min-height: 44px;
      }
      .lead-field textarea { resize: vertical; line-height: 1.5; }
      .lead-field select:focus, .lead-field textarea:focus { outline: none; border-color: var(--accent-deep); box-shadow: 0 0 0 3px rgba(187, 221, 250, 0.4); }
      .lead-save { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .lead-saved { color: var(--good); font-size: 0.88rem; font-weight: 600; }
      @media (min-width: 720px) {
        .leads-head {
          display: grid; grid-template-columns: 1.3fr 1fr 1.2fr; gap: 16px;
          padding: 0 16px 8px; font-size: 0.78rem; font-weight: 600; color: var(--faint);
        }
        .leads-list { gap: 8px; }
        .lead { grid-template-columns: 1.3fr 1fr 1.2fr; gap: 16px; padding: 14px 16px; border-radius: 12px; align-items: start; }
        .lead-links { flex-direction: column; gap: 4px; }
      }

      @media (prefers-reduced-motion: reduce) {
        * { transition: none !important; }
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

  /** Printed inside the upload area, read from the constant that enforces it. */
  readonly sizeLabel = MAX_UPLOAD_LABEL;

  authError = '';
  pickError = '';
  opError = '';
  notice = '';
  title = '';

  items: Testimonial[] = [];

  // ─── Leads ────────────────────────────────────────────────────────────────
  tab: 'media' | 'leads' = 'media';
  leads: Lead[] = [];
  leadsLoaded = false;
  leadsLoading = false;
  leadsError = '';
  leadOpError = '';
  leadFilter: 'all' | LeadStatus = 'all';
  readonly leadFilters: ReadonlyArray<{ value: 'all' | LeadStatus; label: string }> = [
    { value: 'all', label: 'הכול' },
    { value: 'new', label: 'חדשות' },
    { value: 'contacted', label: 'נוצר קשר' },
    { value: 'closed', label: 'סגורות' }
  ];
  leadBusy: string | null = null;
  savedNoteId: string | null = null;
  private noteDrafts = new Map<string, string>();
  private savedNoteTimer?: number;

  srcUrl: string | null = null;
  croppedUrl: string | null = null;
  private source: HTMLImageElement | null = null;
  /** The file the screen currently belongs to; a later pick invalidates it. */
  private opened: File | null = null;
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
    const cfg = await this.media.loadConfig();
    this.configured = !!cfg;
    this.googleAvailable = !!cfg?.googleAuth;

    // If we have just come back from Google the session is in the URL fragment.
    // Take it before anything else, and let the visitor know if they cancelled
    // rather than leaving them staring at the form wondering what happened.
    if (this.configured) {
      const back = this.media.completeOAuthRedirect();
      if (back === 'error') this.authError = 'הכניסה עם Google בוטלה.';
    }

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

  /** True only when the Supabase project really has the Google provider on. */
  googleAvailable = false;

  async signInWithGoogle(): Promise<void> {
    if (this.busy) return;
    this.authError = '';
    this.busy = true;
    this.cdr.markForCheck();
    try {
      // Leaves the page. Nothing after this runs unless it fails to start.
      await this.media.signInWithGoogle();
    } catch {
      this.authError = 'הכניסה עם Google לא זמינה כרגע.';
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  // ─── Leads ────────────────────────────────────────────────────────────────
  get newLeadCount(): number {
    return this.leads.filter((l) => l.status === 'new').length;
  }

  get visibleLeads(): Lead[] {
    return this.leadFilter === 'all' ? this.leads : this.leads.filter((l) => l.status === this.leadFilter);
  }

  countFor(value: 'all' | LeadStatus): number {
    return value === 'all' ? this.leads.length : this.leads.filter((l) => l.status === value).length;
  }

  showTab(tab: 'media' | 'leads'): void {
    this.tab = tab;
    this.cdr.markForCheck();
    if (tab === 'leads' && !this.leadsLoaded && !this.leadsLoading) void this.refreshLeads();
  }

  setLeadFilter(value: 'all' | LeadStatus): void {
    this.leadFilter = value;
    this.cdr.markForCheck();
  }

  async refreshLeads(): Promise<void> {
    this.leadsLoading = true;
    this.leadsError = '';
    this.leadOpError = '';
    this.cdr.markForCheck();
    try {
      this.leads = await this.media.listLeads();
      this.leadsLoaded = true;
      this.noteDrafts.clear();
    } catch {
      this.leadsError = 'לא הצלחנו לטעון את הפניות. בדקי את החיבור ונסי שוב.';
    } finally {
      this.leadsLoading = false;
      this.cdr.markForCheck();
    }
  }

  formatWhen(iso: string): string {
    try {
      return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  /** Digits only, a leading plus kept, so the phone app dials it as typed. */
  telHref(phone: string): string {
    const d = phone.replace(/[^\d+]/g, '');
    return d.startsWith('+') ? '+' + d.slice(1).replace(/\+/g, '') : d;
  }

  /** wa.me wants the international number without a plus: 050… → 97250…. */
  waHref(phone: string): string {
    let d = phone.replace(/\D/g, '');
    if (d.startsWith('972')) { /* already international */ }
    else if (d.startsWith('0')) d = '972' + d.slice(1);
    return `https://wa.me/${d}`;
  }

  async setLeadStatus(lead: Lead, event: Event): Promise<void> {
    const next = (event.target as HTMLSelectElement).value as LeadStatus;
    if (next === lead.status || this.leadBusy) return;
    const previous = lead.status;
    lead.status = next;
    this.leadBusy = lead.id;
    this.leadOpError = '';
    this.cdr.markForCheck();
    try {
      const saved = await this.media.updateLead(lead.id, { status: next });
      lead.status = saved.status;
    } catch {
      lead.status = previous;
      (event.target as HTMLSelectElement).value = previous;
      this.leadOpError = 'שינוי הסטטוס לא נשמר. נסי שוב.';
    } finally {
      this.leadBusy = null;
      this.cdr.markForCheck();
    }
  }

  noteFor(lead: Lead): string {
    return this.noteDrafts.get(lead.id) ?? lead.admin_notes;
  }

  noteDirty(lead: Lead): boolean {
    const draft = this.noteDrafts.get(lead.id);
    return draft !== undefined && draft !== lead.admin_notes;
  }

  draftNote(lead: Lead, event: Event): void {
    this.noteDrafts.set(lead.id, (event.target as HTMLTextAreaElement).value);
    this.cdr.markForCheck();
  }

  async saveNote(lead: Lead): Promise<void> {
    const draft = this.noteDrafts.get(lead.id);
    if (draft === undefined || this.leadBusy) return;
    this.leadBusy = lead.id;
    this.leadOpError = '';
    this.cdr.markForCheck();
    try {
      const saved = await this.media.updateLead(lead.id, { admin_notes: draft.slice(0, 4000) });
      lead.admin_notes = saved.admin_notes;
      this.noteDrafts.delete(lead.id);
      this.savedNoteId = lead.id;
      window.clearTimeout(this.savedNoteTimer);
      this.savedNoteTimer = window.setTimeout(() => {
        this.savedNoteId = null;
        this.cdr.markForCheck();
      }, 2500);
    } catch {
      this.leadOpError = 'ההערה לא נשמרה. נסי שוב.';
    } finally {
      this.leadBusy = null;
      this.cdr.markForCheck();
    }
  }

  /** The leads as loaded, as a UTF-8 CSV with a BOM so Excel reads the Hebrew. */
  exportLeadsCsv(): void {
    const cell = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const label: Record<LeadStatus, string> = { new: 'חדשה', contacted: 'נוצר קשר', closed: 'סגורה' };
    const head = ['תאריך', 'שם מלא', 'טלפון', 'מייל', 'שם העסק', 'הודעה', 'סטטוס', 'הערות', 'מקור'];
    const rows = this.leads.map((l) => [
      this.formatWhen(l.created_at), l.full_name, l.phone, l.email ?? '', l.business_name ?? '',
      l.message ?? '', label[l.status] ?? l.status, l.admin_notes, l.source_path
    ]);
    const csv = '\uFEFF' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  signOut(): void {
    this.media.signOut();
    this.items = [];
    this.leads = [];
    this.leadsLoaded = false;
    this.noteDrafts.clear();
    this.tab = 'media';
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

  /**
   * SELECT -> CHECK -> only then the cropper.
   *
   * Every rejection happens here, before an object URL exists, before an <img>
   * is created and long before anything is uploaded, because the cropper is the
   * first component that would try to interpret the bytes and it has no idea
   * what to do with a video. The order is the protection: content type, then
   * name, then size, then the file's actual signature. Anything that fails drops
   * straight back to the picker with the screen in a clean state.
   */
  async pick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Released first, both so a rejected file leaves no reference behind and so
    // choosing the same file twice still fires a change event.
    input.value = '';
    this.reset();
    if (!file) return;

    const refuse = (message: string): void => {
      this.pickError = message;
      this.cdr.markForCheck();
    };

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!PUBLISHABLE_TYPES.includes((file.type || '').toLowerCase())) return refuse(SAY_ONLY_IMAGES);
    if (!IMAGE_EXTS.includes(ext)) return refuse(SAY_ONLY_IMAGES);
    if (!file.size) return refuse(SAY_UNREADABLE);
    if (file.size > MAX_UPLOAD_BYTES) return refuse(SAY_TOO_BIG);

    try {
      if (!(await isRealImage(file))) return refuse(SAY_ONLY_IMAGES);
    } catch {
      return refuse(SAY_UNREADABLE);
    }

    this.opened = file;
    const url = URL.createObjectURL(file);
    const probe = new Image();
    // Explicitly back inside the zone: an image load handler is not reliably
    // patched, and marking a view dirty only schedules it for the next pass.
    probe.onload = () =>
      this.zone.run(() => {
        // A newer pick may have landed while this one decoded; the screen belongs
        // to the file chosen last, so an overtaken decode is dropped.
        if (this.opened !== file) {
          URL.revokeObjectURL(url);
          return;
        }
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
        this.opened = null;
        refuse(SAY_UNREADABLE);
      });
    probe.src = url;
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
    // The same check again, on the thing actually being sent. The blob here is
    // the canvas export rather than the file she picked, so this can only fail
    // if something upstream went wrong - and if it did, it stops here.
    if (!PUBLISHABLE_TYPES.includes(this.cropped.type) || !this.cropped.size) {
      this.opError = SAY_UNREADABLE;
      this.cdr.markForCheck();
      return;
    }
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
    this.opened = null;
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
