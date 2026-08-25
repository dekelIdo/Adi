import { AfterViewInit, Component, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';

interface PortfolioProject {
  id: string;
  title: string;
  category: string;
  image: string;
  aspectRatio: 'portrait' | 'landscape' | 'square';
  imageMode: 'cover' | 'contain';
  alt: string;
}

/**
 * Social video — architecture for media that does not exist in the repo yet.
 *
 * Deliberately empty below: no placeholder clips, no fake posters. Populate
 * `socialVideos` and the section renders itself; leave it empty and the section
 * is not emitted at all, so the page never shows an empty shelf.
 *
 * Native social ratios are the default. 9:16 is the primary format (Reels /
 * Stories), but 4:5, 1:1 and 16:9 are supported so mixed media can be dropped in
 * without the layout assuming a single shape.
 */
interface SocialVideo {
  id: string;
  /** Video file in src/assets. Keep it muted-inline friendly (H.264 MP4). */
  src: string;
  /** Poster still shown before playback — this is what actually loads on scroll. */
  poster: string;
  /** Opens the original post. */
  instagramUrl: string;
  title: string;
  alt: string;
  aspectRatio: '9:16' | '4:5' | '1:1' | '16:9';
  category?: 'personality' | 'on-action' | 'work' | 'social' | 'proof';
}

interface BrandLogo {
  name: string;
  logo: string;
  href: string;
  scale?: 'clalit' | 'large' | 'default';
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit, OnDestroy {

  // ── REAL_FRAME_B_ASSET ────────────────────────────────────────────────────
  // The laptop bridge is a two-frame interaction:
  //
  //   FRAME A  the whole plate: her body, and it barely moves
  //   FRAME B  the laptop, both hands and the forearm, cut from the same frame
  //            with real alpha
  //
  // Frame B is the same laptop from the same photograph, not a reconstruction.
  // Its registration against the plate was solved by matching the cut-out back
  // against the source rather than by eye, so at the start of the move the two
  // layers are indistinguishable and there is no doubled edge to see.
  //
  // Set this to null to fall back to the plain photographic section; nothing
  // else has to change.
  frameBAsset: string | null = 'assets/lovable-uploads/MyAssets/AdiArieli/frame-b-laptop.png';

  // ── bridgeCinematic ───────────────────────────────────────────────────────
  // Master switch for the laptop move. While false the section is a plain
  // full-bleed photograph with no sticky runway, no veil and no scroll driver.
  //
  // OFF, deliberately. The move is meant to present the laptop's SCREEN to the
  // viewer, and every laptop frame in the shoot was checked: 327, 335 and
  // Me3 (2) show the back of the lid, 389/403/404 show it closed under her arm,
  // and Me1/Me33/honesty-adi have her typing with the display turned away. The
  // screen was never photographed, so the cut-out can only ever bring the back
  // of the lid toward the lens, which tells the wrong story however smooth it
  // is. A wrong story is worse than no animation, so this stays false until a
  // real screen-facing frame exists. Nothing else needs changing when it does.
  bridgeCinematic = true;

  private observer?: IntersectionObserver;
  private headerThemeObserver?: IntersectionObserver;
  private reviewsNudgeObserver?: IntersectionObserver;
  private reelObserver?: IntersectionObserver;
  private scrollListeners: Array<() => void> = [];
  private rafIds: number[] = [];
  backToTopVisible = false;
  openFaqIndex: number | null = null;
  currentHeaderTheme: 'light' | 'dark' = 'dark'; // Start with dark for hero

  brandLogos: BrandLogo[] = [
    { name: 'Clalit Active+', logo: 'assets/brand-logos/clalit-active.svg', href: 'https://www.clalit.co.il', scale: 'clalit' },
    { name: 'Allen Carr', logo: 'assets/lovable-uploads/client-allen-carr.png', href: '#', scale: 'default' },
    { name: 'Movement', logo: 'assets/lovable-uploads/client-movement.png', href: '#', scale: 'large' },
    { name: 'Moon Productions', logo: 'assets/lovable-uploads/client-moon-productions.png', href: '#', scale: 'default' },
    { name: 'Ichilov Well', logo: 'assets/brand-logos/ichilov-well.svg', href: 'https://www.ichilov.org.il', scale: 'default' }
  ];

  /**
   * Real footage from src/assets/.../MyProjects. Both sources are 2160x3840
   * (true 9:16) H.264 masters; `reel-*.mp4` are the web transcodes (1080x1920)
   * and every poster is a real frame lifted out of its own clip, never a
   * fabricated thumbnail.
   *
   * `instagramUrl` is intentionally EMPTY. No real post URLs were supplied and
   * inventing one would ship a dead link, so the template hides the action until
   * a genuine URL is filled in here.
   */
  socialVideos: SocialVideo[] = [
    {
      // Newest clip and the most natively social of the three: real client
      // content shot in a cafe. Seven seconds, so it reads as a loop.
      id: 'reel-6456',
      src: 'assets/lovable-uploads/MyAssets/MyProjects/reel-6456.mp4',
      poster: 'assets/lovable-uploads/MyAssets/MyProjects/reel-6456-poster.jpg',
      instagramUrl: '',
      title: '',
      alt: 'תוכן שצולם ללקוחה',
      aspectRatio: '9:16',
      category: 'social'
    },
    {
      id: 'reel-9',
      src: 'assets/lovable-uploads/MyAssets/MyProjects/reel-9.mp4',
      poster: 'assets/lovable-uploads/MyAssets/MyProjects/reel-9-poster.jpg',
      instagramUrl: '',
      title: '',
      alt: 'עדי אריאלי בצילומים',
      aspectRatio: '9:16',
      category: 'on-action'
    },
    {
      id: 'reel-1',
      src: 'assets/lovable-uploads/MyAssets/MyProjects/reel-1.mp4',
      poster: 'assets/lovable-uploads/MyAssets/MyProjects/reel-1-poster.jpg',
      instagramUrl: '',
      title: '',
      alt: 'סרטון תוכן ללקוחה',
      aspectRatio: '9:16',
      category: 'work'
    }
  ];

  /** id of the clip currently playing, or null. Only one plays at a time. */
  playingVideoId: string | null = null;

  portfolioProjects: PortfolioProject[] = [
    {
      id: 'onaction',
      title: 'OnAction',
      category: 'מיתוג אישי · קמפיין',
      image: 'assets/lovable-uploads/MyAssets/AdiArieli/Me3 (2).jpg',
      aspectRatio: 'portrait',
      imageMode: 'cover',
      alt: 'OnAction - מיתוג אישי וקמפיין'
    },
    {
      id: 'social-growth',
      title: 'צמיחה ברשתות',
      category: 'תוצאות · 10K+ צפיות',
      image: 'assets/lovable-uploads/MyAssets/Results/IMG_7629.PNG',
      aspectRatio: 'landscape',
      imageMode: 'contain',
      alt: '10K+ צפיות לסרטון - תוצאות אמיתיות'
    },
    {
      id: 'engagement',
      title: 'מעורבות גבוהה',
      category: 'תוצאות · ביצועים',
      image: 'assets/lovable-uploads/MyAssets/Results/IMG_7323.PNG',
      aspectRatio: 'landscape',
      imageMode: 'contain',
      alt: 'מעורבות גבוהה ברשתות חברתיות'
    },
    {
      id: 'growth',
      title: 'צמיחה אורגנית',
      category: 'תוצאות · עוקבים',
      image: 'assets/lovable-uploads/MyAssets/Results/IMG_3572.PNG',
      aspectRatio: 'landscape',
      imageMode: 'contain',
      alt: 'צמיחה חודשית בעוקבים - גרף ביצועים'
    }
  ];

  constructor(private zone: NgZone) {}

  /**
   * Tap-to-play, one clip at a time. Video stays poster-only until the visitor
   * asks for it, so nothing downloads a media file on page load.
   */
  toggleVideo(video: SocialVideo, el: HTMLVideoElement): void {
    if (this.playingVideoId === video.id) {
      el.pause();
      this.playingVideoId = null;
      return;
    }

    document.querySelectorAll<HTMLVideoElement>('.social-video-el').forEach((other) => {
      if (other !== el) {
        other.pause();
      }
    });

    el.muted = true; // required for inline autoplay on iOS
    void el.play().then(
      () => (this.playingVideoId = video.id),
      () => (this.playingVideoId = null)
    );
  }

  toggleFaq(i: number): void {
    this.openFaqIndex = this.openFaqIndex === i ? null : i;
  }

  ngAfterViewInit(): void {
    this.initScrollReveal();
    this.initHeaderGlass();
    this.initHeaderTheme(); // NEW: Context-aware header theme
    this.initBackToTop();
    this.initHeroParallax();
    this.initCursorGlow();
    this.initMagneticButtons();
    this.initCarouselDrag();
    this.initReelPlayback();
    this.initLivingPhotograph();
    this.initShootDayReveal();
    this.initLaptopBridge();
    this.initSectionProgress();
    this.initEditorialDrift();
    this.initReviewsNudge();
  }

  // ─── Reviews: one-time idle affordance ────────────────────────────────────────
  // The reviews rail is deliberately NOT a marquee: these are dense message
  // screenshots and the visitor has to be able to read them without chasing.
  // But a rail that never moves reads as static, and the next message sitting
  // behind the edge fade can go unnoticed.
  //
  // So: exactly one nudge, the first time the section is seen. The rail drifts a
  // short way toward the next message, revealing its edge, then settles back to
  // the start so the first message is left fully readable. It never repeats, and
  // it is abandoned the moment the visitor touches the rail themselves.
  private initReviewsNudge(): void {
    const rail = document.querySelector<HTMLElement>('.reviews-outer');
    if (!rail) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let userEngaged = false;
    const engage = () => {
      userEngaged = true;
      remove();
    };
    const events: Array<keyof HTMLElementEventMap> = ['pointerdown', 'touchstart', 'wheel', 'keydown'];
    const remove = () => events.forEach((e) => rail.removeEventListener(e, engage));
    events.forEach((e) => rail.addEventListener(e, engage, { passive: true, once: true }));

    const OUT = 620;
    const HOLD = 220;
    const BACK = 760;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const run = () => {
      // Overflow is checked HERE, not at init: the review screenshots are lazy
      // loaded, so at ngAfterViewInit they have no intrinsic size, the rail does
      // not overflow yet, and an early guard would cancel the hint permanently.
      // By the time the section is on screen the images have real widths.
      if (rail.scrollWidth <= rail.clientWidth + 8) return;

      // Snapping is suspended for the duration so the rail glides and settles
      // instead of being yanked to an alignment point mid-gesture.
      const snap = rail.style.scrollSnapType;
      rail.style.scrollSnapType = 'none';

      // RTL browsers disagree on the sign of scrollLeft, so probe rather than
      // assume. This MUST happen after snapping is off: with snapping active a
      // one-pixel test scroll is immediately snapped back to the start, which
      // makes the negative-offset model look like the positive one and sends the
      // whole animation in the direction that is clamped to zero.
      const start = rail.scrollLeft;
      rail.scrollLeft = start - 1;
      const direction = rail.scrollLeft !== start ? -1 : 1;
      rail.scrollLeft = start;

      const distance = Math.min(46, rail.clientWidth * 0.12) * direction;

      const t0 = performance.now();
      const step = (now: number) => {
        if (userEngaged) {
          rail.style.scrollSnapType = snap;
          return;
        }
        const elapsed = now - t0;
        let offset: number;
        if (elapsed < OUT) {
          offset = distance * easeOut(elapsed / OUT);
        } else if (elapsed < OUT + HOLD) {
          offset = distance;
        } else if (elapsed < OUT + HOLD + BACK) {
          offset = distance * (1 - easeInOut((elapsed - OUT - HOLD) / BACK));
        } else {
          rail.scrollLeft = start;
          rail.style.scrollSnapType = snap;
          return;
        }
        rail.scrollLeft = start + offset;
        const id = requestAnimationFrame(step);
        this.rafIds.push(id);
      };
      const id = requestAnimationFrame(step);
      this.rafIds.push(id);
    };

    this.zone.runOutsideAngular(() => {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            obs.disconnect(); // once, and only once
            if (userEngaged) return;
            window.setTimeout(() => {
              if (!userEngaged) run();
            }, 420);
          });
        },
        // Deliberately low: the rail sits at the foot of its section, so with a
        // high threshold the hint never fires on a normal scroll (at 0.45 it was
        // silently never reaching the callback).
        { threshold: 0.25 }
      );
      obs.observe(rail);
      this.reviewsNudgeObserver = obs;
    });
  }

  // ─── ADI signature: editorial drift ───────────────────────────────────────────
  // Photographs move a few pixels slower than the text beside them as the page
  // scrolls. The intent is that it is FELT, not seen: the maximum offset is 12px,
  // which is enough to stop a composition feeling pinned to the page and far too
  // small to read as a parallax effect.
  //
  // Written to a CSS custom property rather than to `transform` directly, so the
  // reveal animation can keep using the same transform without the two fighting.
  private initEditorialDrift(): void {
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-drift]'));
    if (targets.length === 0) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const MAX = 12; // px — the whole effect, start to finish

    this.zone.runOutsideAngular(() => {
      let ticking = false;

      const update = () => {
        const vh = window.innerHeight;
        targets.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.bottom < -200 || rect.top > vh + 200) return;
          // -1 when the element is entering at the bottom, +1 when leaving at the top
          const progress = (vh / 2 - (rect.top + rect.height / 2)) / (vh / 2 + rect.height / 2);
          const strength = parseFloat(el.dataset['drift'] || '0.5');
          const offset = Math.max(-1, Math.min(1, progress)) * MAX * strength;
          el.style.setProperty('--drift', `${offset.toFixed(2)}px`);
        });
        ticking = false;
      };

      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        const id = requestAnimationFrame(update);
        this.rafIds.push(id);
      };

      update();
      this.scrollListeners.push(onScroll);
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
    });
  }

  // ─── Scroll reveal ─────────────────────────────────────────────────────────
  private initScrollReveal(): void {
    const targets = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    if (targets.length === 0) return;

    if (!('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('is-visible'));
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('is-visible');
            this.observer?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -28px 0px' }
    );
    targets.forEach((t) => this.observer!.observe(t));
  }

  // ─── Header glass — gradual 0→1 CSS var over first 80px of scroll ──────────
  // Smoother than a binary flip: header fades from transparent to glass linearly.
  private initHeaderGlass(): void {
    const host = document.querySelector<HTMLElement>('app-root');
    if (!host) return;

    const RAMP = 80; // px of scroll to go from 0 to 1
    let rafPending = false;

    const update = () => {
      if (!rafPending) {
        rafPending = true;
        const id = requestAnimationFrame(() => {
          const progress = Math.min(1, window.scrollY / RAMP);
          host.style.setProperty('--scrolled', progress.toFixed(3));
          rafPending = false;
        });
        this.rafIds.push(id);
      }
    };

    update();
    this.scrollListeners.push(update);
    window.addEventListener('scroll', update, { passive: true });
  }

  // ─── Header context-aware theme switcher ──────────────────────────────────────
  // The header must adopt the theme of whatever sits DIRECTLY BENEATH IT, so
  // controls stay readable: light section -> dark controls, dark/photographic
  // section -> light controls.
  //
  // This previously used an IntersectionObserver that fired for every section
  // more than 30% visible and let the last callback win. At the top of a desktop
  // viewport the dark hero AND the light brands band are both visible, so the
  // brands band decided the theme and the header rendered dark-on-dark over the
  // hero photograph — the CTA was effectively invisible on first paint.
  //
  // Reading the section that actually spans the header's own baseline is both
  // simpler and exact, at any viewport height.
  private initHeaderTheme(): void {
    const header = document.querySelector<HTMLElement>('.site-header');
    if (!header) return;

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('[data-header-theme]')
    );
    if (sections.length === 0) return;

    const apply = () => {
      // Probe just below the header so the theme reflects what it overlaps.
      const probeY = header.getBoundingClientRect().bottom - 1;

      let theme: 'light' | 'dark' | null = null;
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= probeY && rect.bottom > probeY) {
          theme = section.getAttribute('data-header-theme') as 'light' | 'dark';
        }
      }
      // Above the first section (rubber-band scroll) keep the hero's theme.
      if (!theme) {
        theme = (sections[0].getAttribute('data-header-theme') as 'light' | 'dark') ?? 'dark';
      }

      if (theme !== this.currentHeaderTheme) {
        this.currentHeaderTheme = theme;
      }
      // Always write it: on first paint the attribute does not exist yet, so a
      // change-only guard would leave the header unthemed.
      header.setAttribute('data-theme', theme);
    };

    this.zone.runOutsideAngular(() => {
      let ticking = false;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        const id = requestAnimationFrame(() => {
          apply();
          ticking = false;
        });
        this.rafIds.push(id);
      };

      apply();
      this.scrollListeners.push(onScroll);
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
    });
  }

  // ─── Back to top ───────────────────────────────────────────────────────────
  private initBackToTop(): void {
    const update = () => {
      this.backToTopVisible = window.scrollY > 400;
    };
    update();
    this.scrollListeners.push(update);
    window.addEventListener('scroll', update, { passive: true });
  }

  // ─── Hero parallax ─────────────────────────────────────────────────────────
  // The hero's first scroll. This previously targeted .hero-bg img and
  // .hero-orb, neither of which exists in the markup any more, so it returned
  // early and the hero had no scroll response at all.
  //
  // Two speeds, one move: the type lifts away over the first third of the hero
  // while the photograph keeps pushing in behind it. The picture outlasting the
  // words is what makes the handoff into the statement strip feel authored
  // instead of feeling like the hero simply ended.
  private initHeroParallax(): void {
    const hero = document.querySelector<HTMLElement>('.hero');
    const picture = document.querySelector<HTMLElement>('.hero-portrait-full picture');
    const exit = document.querySelector<HTMLElement>('.hero-exit');
    if (!hero || !picture || !exit) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

    this.zone.runOutsideAngular(() => {
      let ticking = false;

      const update = () => {
        ticking = false;
        const h = hero.offsetHeight || window.innerHeight;
        // Nothing to do once the hero is fully behind us.
        if (window.scrollY > h * 1.2) return;

        const p = clamp01(window.scrollY / h);

        // The photograph closes in slowly and drifts up at less than scroll
        // speed, so it lags the page and stays present under the strip.
        picture.style.setProperty('--hero-depth', (1 + p * 0.07).toFixed(4));
        picture.style.setProperty('--hero-shift', `${(p * -22).toFixed(1)}px`);

        // The words go first: gone by a third of the hero.
        const typeOut = clamp01(p / 0.34);
        exit.style.setProperty('--hero-type-y', `${(typeOut * -46).toFixed(1)}px`);
        exit.style.setProperty('--hero-type-o', (1 - typeOut).toFixed(3));
      };

      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        const id = requestAnimationFrame(update);
        this.rafIds.push(id);
      };

      update();
      window.addEventListener('scroll', onScroll, { passive: true });
      this.scrollListeners.push(onScroll);
    });
  }

  // ─── Cursor glow on cards ─────────────────────────────────────────────────
  private initCursorGlow(): void {
    if (!window.matchMedia('(hover:hover)').matches) return;

    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.editorial-img, .reel-frame, .result-frame, .story-card'
      )
    );

    targets.forEach((el) => {
      el.addEventListener(
        'mousemove',
        (e: MouseEvent) => {
          const rect = el.getBoundingClientRect();
          el.style.setProperty('--x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
          el.style.setProperty('--y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
        },
        { passive: true }
      );
    });
  }

  // ─── Magnetic buttons ─────────────────────────────────────────────────────
  // On hover, buttons shift slightly toward the cursor for a premium tactile feel.
  private initMagneticButtons(): void {
    if (!window.matchMedia('(hover:hover)').matches) return;

    const btns = Array.from(document.querySelectorAll<HTMLElement>('.btn'));

    btns.forEach((btn) => {
      const STRENGTH = 5; // max pixel shift

      btn.addEventListener(
        'mousemove',
        (e: MouseEvent) => {
          const rect = btn.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = ((e.clientX - cx) / rect.width) * 2;
          const dy = ((e.clientY - cy) / rect.height) * 2;
          btn.style.setProperty('--mx', String((dx * STRENGTH).toFixed(2)));
          btn.style.setProperty('--my', String((dy * STRENGTH).toFixed(2)));
        },
        { passive: true }
      );

      const reset = () => {
        btn.style.setProperty('--mx', '0');
        btn.style.setProperty('--my', '0');
      };
      btn.addEventListener('mouseleave', reset);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCROLLING SYSTEMS — THREE INDEPENDENT, NON-OVERLAPPING IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // 1. BRAND CAROUSEL (+ statement strip) — CSS ONLY. NOT MANAGED HERE.
  //    Markup:  .brand-track / .brand-track-set (duplicated via *ngFor brandLogos)
  //    Motion:  @keyframes brandScroll, translate3d(0 -> -50%), 28s linear infinite
  //    Because both -set blocks render the identical brandLogos array, -50% lands
  //    exactly one set along, so the loop is seamless with no visible reset.
  //
  //    DO NOT reintroduce a requestAnimationFrame driver for this carousel.
  //    A previous rAF implementation produced the empty-carousel bug. The CSS
  //    animation is continuous, works on mobile, needs no JS, and cannot render
  //    an empty state. No querySelector in this file may target .brand-track*.
  //
  // 2. PORTFOLIO REEL  — rAF marquee. Owns ONLY .portfolio-reel-outer/-track.
  // 3. RESULTS REEL    — rAF marquee. Owns ONLY .results-outer/.results-rail.
  // 4. REVIEWS ROW     — native scrollLeft drag. Owns ONLY .reviews-outer.
  //
  // 2/3/4 have disjoint selector scopes and disjoint rAF loops; none observes or
  // mutates another's DOM. Keep it that way — widen a selector and two loops will
  // fight over the same transform.
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Carousel drag-to-scroll with momentum ────────────────────────────────
  // Enables mouse-drag scrolling on desktop with smooth momentum decay.
  private initCarouselDrag(): void {
    const containers = Array.from(
      document.querySelectorAll<HTMLElement>('.reviews-outer')
    );

    containers.forEach((container) => {
      let isDown = false;
      let startX = 0;
      let scrollStart = 0;
      let velocity = 0;
      let lastX = 0;
      let momentumId: number;

      const stopMomentum = () => cancelAnimationFrame(momentumId);

      const applyMomentum = () => {
        if (Math.abs(velocity) < 0.4) return;
        velocity *= 0.92; // friction coefficient
        container.scrollLeft -= velocity;
        momentumId = requestAnimationFrame(applyMomentum);
        this.rafIds.push(momentumId);
      };

      container.addEventListener('mousedown', (e: MouseEvent) => {
        isDown = true;
        stopMomentum();
        startX = e.pageX - container.offsetLeft;
        scrollStart = container.scrollLeft;
        lastX = e.pageX;
        velocity = 0;
      });

      const onUp = () => {
        if (!isDown) return;
        isDown = false;
        applyMomentum();
      };

      container.addEventListener('mouseleave', onUp);
      container.addEventListener('mouseup', onUp);

      container.addEventListener('mousemove', (e: MouseEvent) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const delta = x - startX;
        velocity = e.pageX - lastX;
        lastX = e.pageX;
        container.scrollLeft = scrollStart - delta;
      });
    });
  }

  // ─── Laptop reveal into the process chapter (mobile only) ────────────────────
  // She is holding her laptop out; the camera closes on it, focus falls off her
  // body, and the process chapter is uncovered as the frame gives way.
  //
  // WHY THIS IS ONE UNCUT PLANE. The intent was a layered 2.5D build with the
  // laptop and hands separated from the body. That needs a real alpha matte, and
  // this frame will not give one: the cyclorama carries a vignette and the lid is
  // rose-gold, so a colour key either leaves a rectangle of half-opaque backdrop
  // around the laptop or begins eating the lid itself. Both read as a pasted
  // cut-out. A matte good enough for this shot has to be rotoscoped properly, or
  // the screen-facing frame has to be shot; it cannot be thresholded out of this
  // photograph.
  //
  // So the depth is optical rather than geometric. The scale origin sits ON the
  // laptop, which is the part that matters: the lid holds its position while the
  // room expands past it, the way a lens moving closer behaves, and a rack focus
  // pulls the body out of sharpness as the laptop approaches. No matte, no seam,
  // no invented anatomy, and the hand can never detach because nothing was cut.
  private initLaptopBridge(): void {
    const stage = document.querySelector<HTMLElement>('.bridge-stage');
    const sticky = document.querySelector<HTMLElement>('.bridge-sticky');
    const scene = document.querySelector<HTMLElement>('.bridge-scene');
    const base = document.querySelector<HTMLElement>('.bridge-frame--a');
    const baseImg = document.querySelector<HTMLImageElement>('.bridge-frame--a img');
    const veil = document.querySelector<HTMLElement>('.bridge-veil');
    const frameB = document.querySelector<HTMLElement>('.bridge-frame--b');
    const next = document.querySelector<HTMLElement>('#process');
    const HANDOFF_VH = 65;
    if (!stage || !sticky || !scene || !base || !baseImg || !veil) return;

    if (!this.bridgeCinematic) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // ── The scene, in one coordinate space ───────────────────────────────────
    //
    // Everything below is a fraction of the SOURCE PHOTOGRAPH, and the plate and
    // the cut-out are laid out together in a single untransformed box BASE wide.
    // One transform then moves that box. Nothing here uses object-fit: the
    // previous build let `cover` decide the framing, so the picture was cropped
    // differently at every viewport height and the laptop's size in frame was a
    // side effect of the phone rather than a decision. Here the viewport is only
    // the camera's window.
    const IMG_R = 4201 / 2806;   // the frame's height per unit width
    const BASE = 1000;

    // Measured, not estimated. The cut-out's alpha channel IS the laptop, both
    // hands and her forearm, so its opaque bounding box, projected back through
    // its own registration, gives the assembly's true extent in the frame:
    //   x 0.031 .. 0.767, y 0.159 .. 0.509
    // Her face and hair sit at x 0.56 .. 0.85, y 0.05 .. 0.22.
    //
    // THE TWO FRAMINGS. The camera moves between these and nothing else about it
    // is tuned: every number the driver writes is derived from them and from the
    // shape of the window it has to fill.
    const ESTABLISH = { x0: 0.031, x1: 0.723, y0: 0.030, y1: 0.560 };
    const CLOSE = { x0: 0.031, x1: 0.580, y0: 0.159, y1: 0.510 };

    // The cut-out's registration against the plate, in the same fractions.
    const FB_X = 0.0;
    const FB_Y = 0.098;
    const FB_W = 0.7667;

    const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
    const clamp01 = (v: number) => clamp(v, 0, 1);
    const track = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
    const ease = (v: number) => v * v * (3 - 2 * v);

    // The smallest window of a given screen shape that still holds a piece of
    // the photograph, centred on it and kept inside the frame. This is what lets
    // one composition survive every viewport: the content is fixed and the
    // window grows in whichever direction the screen is long.
    const fit = (c: { x0: number; x1: number; y0: number; y1: number }, aspect: number) => {
      const k = aspect * IMG_R;                 // window width per unit height, in fractions
      let ch = Math.max(c.y1 - c.y0, (c.x1 - c.x0) / k);
      let cw = k * ch;
      const shrink = Math.min(1, 1 / cw, 1 / ch);
      cw *= shrink;
      ch *= shrink;
      return {
        cx: clamp((c.x0 + c.x1) / 2 - cw / 2, 0, 1 - cw),
        cy: clamp((c.y0 + c.y1) / 2 - ch / 2, 0, 1 - ch),
        cw,
        ch
      };
    };

    this.zone.runOutsideAngular(() => {
      let ticking = false;

      const update = () => {
        ticking = false;
        if (window.innerWidth >= 768) return;

        const rect = stage.getBoundingClientRect();
        const travel = rect.height - window.innerHeight;
        if (travel <= 0) return;

        const p = clamp01(-rect.top / travel);

        // THE HANDOFF, first: the camera has to know how much of its window the
        // process chapter has taken before it can frame anything.
        if (next) {
          const reveal = track(p, 0.52, 0.92);
          const eased = reveal * reveal * (3 - 2 * reveal);
          next.style.setProperty('--handoff-y', `${((1 - eased) * HANDOFF_VH * window.innerHeight / 100).toFixed(1)}px`);
        }

        // The window the shot is actually seen through: the whole viewport until
        // the next chapter starts climbing over it, then whatever is left above
        // that edge. Framing against this rather than against the viewport is
        // what makes the last third read as one camera finishing its move. The
        // shot recomposes into the strip it still has, so the laptop and the
        // hands stay centred in it instead of being pushed out of the bottom.
        const winW = window.innerWidth;
        const winH = clamp(next ? next.getBoundingClientRect().top : window.innerHeight, 220, window.innerHeight);

        // THE CAMERA. Two framings, eased between: it opens holding Adi, the
        // laptop, both hands and the bracelet, and closes on the laptop and the
        // hands. Both are fitted to the window's shape, so this is one
        // composition adapted to the screen, not three compositions.
        // Front-loaded on purpose. The last fifth of the shot is where the window
        // itself is changing shape as the chapter climbs over it, and that is a
        // large recomposition on its own; the push-in finishes before it so the
        // two do not fight for the eye.
        const move = ease(track(p, 0.06, 0.80));
        const a = fit(ESTABLISH, winW / winH);
        const b = fit(CLOSE, winW / winH);
        const cw = a.cw + (b.cw - a.cw) * move;
        const cx = a.cx + (b.cx - a.cx) * move;
        const cy = a.cy + (b.cy - a.cy) * move;

        // Map that window onto the strip. A single uniform scale, so the laptop
        // keeps its photographic proportions at every point in the move by
        // construction: there is nothing here that could stretch it.
        const s = winW / (cw * BASE);
        scene.style.setProperty('--cam-s', s.toFixed(5));
        scene.style.setProperty('--cam-x', `${(-cx * BASE * s).toFixed(1)}px`);
        scene.style.setProperty('--cam-y', `${(-cy * BASE * IMG_R * s).toFixed(1)}px`);

        // Rack focus. The plate falls fractionally out of focus as the object in
        // front of it comes forward, which is what puts the two at different
        // distances from the lens.
        const soften = ease(track(p, 0.46, 0.95));
        base.style.setProperty('--base-blur', `${(soften * 1.2).toFixed(2)}px`);
        base.style.setProperty('--base-bright', (1 - soften * 0.025).toFixed(3));

        // FRAME B: the real laptop, hands and forearm, cut from this same
        // photograph. It sits exactly on its own source in the plate and then
        // advances a little, which is the parallax that separates the object
        // from the room. Small on purpose: a cut-out covers its own source only
        // while it stays inside 2 * COVER - 1, and the camera carries the
        // movement now, so this layer does not have to.
        if (frameB) {
          frameB.style.left = `${(FB_X * BASE).toFixed(1)}px`;
          frameB.style.top = `${(FB_Y * BASE * IMG_R).toFixed(1)}px`;
          frameB.style.width = `${(FB_W * BASE).toFixed(1)}px`;

          const COVER = 1.05;
          const advance = ease(track(p, 0.18, 0.92));
          frameB.style.setProperty('--fb-scale', (COVER + advance * 0.045).toFixed(4));
          frameB.style.setProperty('--fb-opacity', track(p, 0.04, 0.14).toFixed(3));
          frameB.style.setProperty('--fb-shadow-y', `${(2 + advance * 9).toFixed(0)}px`);
          frameB.style.setProperty('--fb-shadow-b', `${(5 + advance * 16).toFixed(0)}px`);
        }

        veil.style.setProperty('--bridge-veil', '0');
      };

      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        const id = requestAnimationFrame(update);
        this.rafIds.push(id);
      };

      update();
      this.scrollListeners.push(onScroll);
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      if (!baseImg.complete) baseImg.addEventListener('load', onScroll, { once: true });
    });
  }

  // ─── Shoot day: the supporting details slide out ──────────────────────────────
  // The two production stills start tucked behind the heroic frame and move out
  // as the section is scrolled through, like a behind-the-scenes layer being
  // lifted. Deliberately small: a short travel and a fade, nothing that competes
  // with the Living Photograph further up the page.
  //
  // Transform and opacity only, written to custom properties so the CSS keeps
  // ownership of the resting state. If this never runs the pictures are simply
  // in place and fully visible.
  private initShootDayReveal(): void {
    const section = document.querySelector<HTMLElement>('#shoot-day');
    const details = Array.from(document.querySelectorAll<HTMLElement>('[data-shoot-reveal]'));
    if (!section || details.length === 0) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.zone.runOutsideAngular(() => {
      let ticking = false;

      const update = () => {
        ticking = false;
        const rect = section.getBoundingClientRect();
        const vh = window.innerHeight;
        if (rect.bottom < -100 || rect.top > vh + 100) return;

        // 0 as the section arrives from below, 1 once it is settled in view.
        const raw = (vh - rect.top) / (vh + rect.height * 0.45);
        const p = raw < 0 ? 0 : raw > 1 ? 1 : raw;

        details.forEach((el) => {
          const order = parseFloat(el.dataset['shootReveal'] || '1');
          const start = 0.16 + order * 0.07;
          const t = Math.min(1, Math.max(0, (p - start) / 0.42));
          const eased = 1 - Math.pow(1 - t, 3);
          el.style.setProperty('--shoot-y', `${((1 - eased) * 34).toFixed(2)}px`);
          el.style.setProperty('--shoot-o', (0.15 + eased * 0.85).toFixed(3));
        });
      };

      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        const id = requestAnimationFrame(update);
        this.rafIds.push(id);
      };

      update();
      this.scrollListeners.push(onScroll);
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
    });
  }

  // ─── The Living Photograph ────────────────────────────────────────────────────
  // The page's single cinematic moment, used once. As the visitor scrolls through
  // the sticky stage, the phone in her raised hand opens into the WORK chapter.
  //
  // The photograph itself is never cut up. A separate element is parked exactly
  // where the phone is and scaled up, so the illusion cannot break the way a
  // hand-masked cut-out would. Finding "exactly where the phone is" is the only
  // real work here: the phone sits at a known point in the SOURCE image, but the
  // image is rendered with object-fit cover on desktop, so that point has to be
  // projected through the cover transform to find it on screen.
  //
  // Driven straight from scroll position, so the visitor controls it in both
  // directions with no easing, no snapping and no autoplay.
  private initLivingPhotograph(): void {
    const stage = document.querySelector<HTMLElement>('.action-stage');
    const frame = document.querySelector<HTMLElement>('.action-frame');
    const img = document.querySelector<HTMLImageElement>('.action-frame img');
    const portal = document.querySelector<HTMLElement>('.action-portal');
    const mark = document.querySelector<HTMLElement>('.margin-mark--action');
    // The chapter this transition opens onto. It is driven from here so the
    // cinematic and the arrival of the content are one scroll, not two stages.
    const next = document.querySelector<HTMLElement>('#portfolio');
    // Must match the negative margin on .section-action.
    const HANDOFF_VH = 80;
    if (!stage || !frame || !img || !portal) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Where the phone sits in the source photograph, measured off the file.
    const PHONE_U = 0.451;
    const PHONE_V = 0.175;

    // Projects a normalised source point onto the rendered element, honouring
    // object-fit / object-position. Without this the portal drifts away from her
    // hand at every viewport that crops the image differently.
    const phonePoint = () => {
      const r = img.getBoundingClientRect();
      const nw = img.naturalWidth || 4201;
      const nh = img.naturalHeight || 2806;
      const cs = getComputedStyle(img);
      let dw = r.width;
      let dh = r.height;
      let offX = 0;
      let offY = 0;

      if (cs.objectFit === 'cover' || cs.objectFit === 'contain') {
        const scale =
          cs.objectFit === 'cover'
            ? Math.max(r.width / nw, r.height / nh)
            : Math.min(r.width / nw, r.height / nh);
        dw = nw * scale;
        dh = nh * scale;
        const pos = cs.objectPosition.split(' ');
        const px = parseFloat(pos[0]) / 100;
        const py = parseFloat(pos[1] ?? pos[0]) / 100;
        offX = (r.width - dw) * (isNaN(px) ? 0.5 : px);
        offY = (r.height - dh) * (isNaN(py) ? 0.5 : py);
      }

      const stickyRect = (portal.parentElement as HTMLElement).getBoundingClientRect();
      return {
        x: r.left - stickyRect.left + offX + PHONE_U * dw,
        y: r.top - stickyRect.top + offY + PHONE_V * dh
      };
    };

    const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
    // Maps a value from one range to another and clamps, so each stage of the
    // move can own its own slice of the scroll.
    const track = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

    this.zone.runOutsideAngular(() => {
      let ticking = false;

      const update = () => {
        ticking = false;
        const rect = stage.getBoundingClientRect();
        const travel = rect.height - window.innerHeight;
        if (travel <= 0) return;

        const p = clamp01(-rect.top / travel);

        // She stays calm: the photograph barely moves. All the motion the eye
        // reads belongs to the object, which is the whole point of the illusion.
        frame.style.transform = `scale(${(1 + 0.05 * track(p, 0.04, 1)).toFixed(4)})`;

        const pt = phonePoint();
        portal.style.setProperty('--portal-x', `${pt.x.toFixed(1)}px`);
        portal.style.setProperty('--portal-y', `${pt.y.toFixed(1)}px`);

        // The portal appears in her hand, grows slowly while it still reads as a
        // phone, then accelerates once it is clearly a doorway rather than an
        // object. Scale is expressed against the viewport so it always finishes
        // covering, whatever the screen.
        // Phases begin almost at once and finish at the very end. With a 152vh
        // stage there is only about half a viewport of travel, so spending any
        // of it idle would force the motion itself to move faster to keep up.
        const emerge = track(p, 0.05, 0.34);
        const open = track(p, 0.30, 0.86);
        // The device element carries the cut-out handset at its own aspect
        // ratio, 119x287. The curve is unchanged; the constants are only
        // renormalised against that base, so the phone is the same number of
        // pixels wide at every point in the move as it was before: it starts at exactly the width her own phone occupies in the
        // photograph and finishes covering the viewport 2.4 times over.
        const need = (Math.max(window.innerWidth, window.innerHeight) * 2.4) / 119;
        // It has to arrive at HER phone's size, not at a size of its own. Hers
        // is about 60px across in a 4201px source, which is roughly 12px on a
        // 390 screen; starting at 26 put a slab in front of her hand instead of
        // taking its place. The emerge term absorbs the difference, so the
        // device is the same size from the end of the emerge beat onward.
        const scale = 0.105 + emerge * 0.2445 + Math.pow(open, 2.1) * need;

        portal.style.setProperty('--portal-scale', scale.toFixed(3));
        // Solid almost at once. Fading a physical object in over a sixth of the
        // stage meant her real phone and her fingers showed straight through the
        // body of this one, which is the one thing that cannot happen: a
        // see-through handset reads as a decal, not as an object.
        portal.style.setProperty('--portal-opacity', track(p, 0.02, 0.09).toFixed(3));

        // The body dissolves as the screen becomes the page. Scaling by fifteen
        // would otherwise turn a 21px corner into a 320px one and the phone
        // would read as a picture frame around the chapter instead of a device.
        const dissolve = track(p, 0.52, 0.80);
        const dEased = dissolve * dissolve * (3 - 2 * dissolve);
        portal.style.setProperty('--dev-r', (1 - dEased).toFixed(3));
        // The screen keeps showing the WORK chapter's own opening the whole way
        // in. Left alone the type would be magnified with the body and end up
        // twenty times its size, so the content is counter-scaled: past the
        // point where the device fills the frame the headline holds at roughly
        // the size the real chapter sets it in, and the two match when it lands.
        // It then dissolves exactly as the real header crosses the bottom edge,
        // so the two never stand side by side as a doubled headline, and the
        // screen is never a dark rectangle waiting for a section to climb in.
        portal.style.setProperty('--dev-cs', Math.min(1, 3 / scale).toFixed(4));
        portal.style.setProperty('--dev-screen', (1 - track(p, 0.62, 0.74)).toFixed(3));
        // The phone is held at an angle; the portal starts matching it and
        // straightens as it stops being an object and becomes the next chapter.
        // Measured off the source frame, her phone leans about 21 degrees with
        // the top to the right, along her raised forearm. The old -18 leaned it
        // the other way, against the arm, which was most of why the device read
        // as pasted onto the photograph rather than held in it.
        portal.style.setProperty('--portal-rot', `${(21 * (1 - open)).toFixed(2)}deg`);

        if (mark) {
          mark.style.setProperty('--mark-opacity', (1 - track(p, 0.04, 0.24)).toFixed(3));
        }

        // THE HANDOFF. The next chapter is parked 65vh below where its margin
        // would otherwise put it, and comes up through the last third of the
        // same scroll. So by the time the portal has filled the screen the
        // chapter it opens onto is already there to read, and the visitor never
        // scrolls through a black frame waiting for something to arrive.
        if (next) {
          const reveal = track(p, 0.40, 0.88);
          const eased = reveal * reveal * (3 - 2 * reveal);
          next.style.setProperty('--handoff-y', `${((1 - eased) * HANDOFF_VH * window.innerHeight / 100).toFixed(1)}px`);
        }
      };

      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        const id = requestAnimationFrame(update);
        this.rafIds.push(id);
      };

      update();
      this.scrollListeners.push(onScroll);
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      // Geometry depends on the image's real size, so recompute once it lands.
      if (!img.complete) img.addEventListener('load', onScroll, { once: true });
    });
  }

  // ─── Image reels: playback only ───────────────────────────────────────────────
  // The portfolio and results reels are pure CSS marquees (see reelScroll). This
  // does NOT position them and never touches transform or visibility: the track
  // rests at transform 0 with its first set filling the viewport, so the reel is
  // fully composed before any script runs.
  //
  // It previously ran a requestAnimationFrame loop that started at page load and
  // read track.scrollWidth every frame. Two consequences: a visitor who spent
  // twenty seconds anywhere above the fold arrived at a track already translated
  // roughly 900px, which rendered as an empty section, and the width it measured
  // was wrong anyway while the images inside were still lazy loading.
  //
  // All this does now is start the animation when a reel is on screen and pause
  // it when it is not, which keeps it off the CPU while off screen. Pausing
  // holds position, and any position in a seamless loop still shows content.
  private initReelPlayback(): void {
    const tracks = Array.from(
      document.querySelectorAll<HTMLElement>('.portfolio-reel-track, .results-rail')
    );
    if (tracks.length === 0) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.zone.runOutsideAngular(() => {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            entry.target.classList.toggle('is-reeling', entry.isIntersecting);
          });
        },
        { rootMargin: '120px 0px' }
      );
      tracks.forEach((t) => obs.observe(t));
      this.reelObserver = obs;
    });
  }


  // ─── Section ambient indicator ────────────────────────────────────────────
  private initSectionProgress(): void {
    const host = document.querySelector<HTMLElement>('app-root');
    if (!host) return;

    const darkSections = new Set(['contact', 'portfolio', 'honesty']);

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).id;
            host.classList.toggle('in-dark-section', darkSections.has(id));
          }
        });
      },
      { threshold: 0.4 }
    );

    document.querySelectorAll<HTMLElement>('section[id]').forEach((s) => obs.observe(s));
  }


  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.headerThemeObserver?.disconnect();
    this.reviewsNudgeObserver?.disconnect();
    this.reelObserver?.disconnect();
    this.rafIds.forEach((id) => cancelAnimationFrame(id));
    this.scrollListeners.forEach((fn) => {
      window.removeEventListener('scroll', fn);
      window.removeEventListener('resize', fn);
    });
  }
}
