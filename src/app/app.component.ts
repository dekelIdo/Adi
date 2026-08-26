import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, NgZone } from '@angular/core';
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

/**
 * A picture in the testimonials rail. `width` and `height` are required, not
 * decorative: the cards take their size from the picture, so the markup has to
 * declare an aspect ratio before the image loads. Without it the cards render
 * 0x0, the rail collapses below the fold, and the lazy images never enter the
 * viewport to load at all.
 */
interface Review {
  src: string;
  alt: string;
  width: number;
  height: number;
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
  // Deliberately off. The bridge is one photograph and a camera now; a cut-out
  // laid over the plate is the one thing this chapter must not look like, and
  // this one ended mid-forearm at the edge of its own file, so any advance at
  // all stepped her arm sideways along a hard vertical seam.
  frameBAsset: string | null = null;

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
  /**
   * THE FALLBACK IS THE DEFAULT. These three are the set that has always
   * shipped, and they are what renders unless published records are fetched
   * successfully. If the media service is unconfigured, unreachable, slow or
   * returns nothing usable, this array is never touched and the section looks
   * exactly as it does today. The public site does not depend on the admin.
   */
  reviews: Review[] = [
    { src: 'assets/lovable-uploads/MyAssets/Reviews/14050.jpg', alt: 'עדות לקוחה', width: 1170, height: 1280 },
    { src: 'assets/lovable-uploads/MyAssets/Reviews/IMG_6712.PNG', alt: 'עדות לקוחה', width: 1064, height: 932 },
    { src: 'assets/lovable-uploads/MyAssets/Reviews/IMG_6715.PNG', alt: 'עדות לקוחה', width: 1320, height: 547 }
  ];

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

  constructor(private zone: NgZone, private cdr: ChangeDetectorRef) {}

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
    void this.loadPublishedReviews();
  }

  /**
   * Swaps in the published pictures if, and only if, they arrive intact.
   *
   * Every failure path keeps the static set: no config, a network error, a bad
   * status, an empty list, or rows missing the dimensions the rail needs. The
   * service itself never throws for the public read, so this cannot break the
   * page even if the provider disappears entirely.
   *
   * Loaded after the first paint, so the section is never blank waiting for it.
   */
  private async loadPublishedReviews(): Promise<void> {
    try {
      const { MediaService } = await import('./admin/media.service');
      const rows = await new MediaService().listPublished();
      if (!rows?.length) return;
      // Explicitly back inside the zone before touching the model. The work is
      // started after the view is initialised and finishes in a callback the
      // framework is not necessarily watching, so without this the array was
      // replaced correctly and the section carried on rendering the old one.
      this.zone.run(() => {
        this.reviews = rows.map((r) => ({
          src: r.url,
          alt: r.title || 'עדות לקוחה',
          width: r.width,
          height: r.height
        }));
        this.cdr.markForCheck();
        // Hand the new cards to the reveal observer on the next frame, once the
        // view has actually been rebuilt.
        //
        // NOT with a synchronous detectChanges: this runs inside a promise
        // during ngAfterViewInit, where a nested pass can throw, and the catch
        // below would swallow it. The array had already been replaced by then,
        // so the cards rendered and were never observed, which is exactly the
        // opacity-zero bug this is here to prevent.
        //
        // Anything already on screen is revealed outright rather than observed:
        // an element that is intersecting when it is first watched will not
        // always produce a callback, and a testimonial that never fades in is a
        // far worse failure than one that does not animate.
        requestAnimationFrame(() => {
          const cards = document.querySelectorAll<HTMLElement>('#testimonials .reveal');
          cards.forEach((el) => {
            const box = el.getBoundingClientRect();
            const onScreen = box.top < window.innerHeight && box.bottom > 0;
            if (onScreen || !this.observer) el.classList.add('is-visible');
            else this.observer.observe(el);
          });
        });
      });
    } catch {
      /* the static set stays */
    }
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
    const card = document.querySelector<HTMLElement>('.laptop-card');
    // The placement lives on the outer element: a custom property set on a child
    // does not reach its parent, and the parent is what reads this one.
    const cardPlace = document.querySelector<HTMLElement>('.laptop-place');
    const base = document.querySelector<HTMLElement>('.bridge-frame--a');
    const baseImg = document.querySelector<HTMLImageElement>('.bridge-frame--a img');
    const veil = document.querySelector<HTMLElement>('.bridge-veil');
    const next = document.querySelector<HTMLElement>('#process');
    const HANDOFF_VH = 48;
    if (!stage || !sticky || !scene || !base || !baseImg || !veil) return;

    if (!this.bridgeCinematic) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // ── One camera, moving through one photograph ────────────────────────────
    //
    // Built on the same shape as the phone chapter further down the page: a
    // single subject measured off the picture, a single uniform scale, and a
    // next chapter that rises over the shot while the subject is still in it.
    // Nothing here is a compensation for something else.
    //
    // The plate and the camera live in one coordinate space: the picture is laid
    // out BASE wide at its natural aspect and one transform moves it. There is
    // no object-fit anywhere in this path, so the framing is a decision rather
    // than a side effect of the viewport's shape.
    const IMG_R = 4201 / 2806;   // the frame's height per unit width
    const BASE = 1000;
    // The plate's real pixel width. The camera is not allowed to render the
    // picture larger than this: past it the push-in is asking the photograph for
    // detail it does not have, and at 1440 the close shot was arriving as a soft
    // upscaled blur rather than as a close shot.
    const NATIVE_W = 2600;

    // Measured, not estimated: the cut-out's alpha channel is the laptop, the
    // hands and her forearm, so its opaque bounding box projected back through
    // its registration gives the assembly's true extent. Her face and hair sit
    // at x 0.56..0.85, y 0.05..0.22.
    //
    // SUBJECT is the part the shot is about: lid, deck and both hands. The
    // forearm running out to 0.767 is allowed to leave the frame in a close
    // shot, the way an arm does when a camera comes in.
    const SUBJECT = { x0: 0.031, x1: 0.500, y0: 0.159, y1: 0.509 };
    // ESTABLISH is the first frame: the whole gesture plus enough of her to read
    // as a photograph of a person working, not a product shot.
    const ESTABLISH = { x0: 0.010, x1: 0.800, y0: 0.030, y1: 0.560 };
    // Where the camera holds the subject, and where on screen it holds it.
    //
    // FIXED. Measured against the phone chapter, whose subject sits at 0.451 of
    // the width and 0.400 of the height at the first frame and 0.449 / 0.395 at
    // the last: the object does not move, the room comes to it. This shot was
    // drifting 60px sideways and 113px upward over the same interval, because
    // the horizontal hold was clamped at the opening and released as the zoom
    // grew, and because the vertical hold was being ramped. Both are gone.
    //
    // 0.38 is the largest horizontal hold that never clamps at the widest
    // window, which is what makes it fixed rather than nearly fixed. The
    // vertical hold equals the anchor's own height in the picture, which is
    // forced: at the opening the window is the full height of the frame, so the
    // anchor can only land at its own fraction.
    const ANCHOR = { x: 0.2655, y: 0.118 };
    const HOLD = { x: 0.38, y: 0.14 };

    // THE VERTICAL HOLD KEEPS HER FACE IN THE FRAME.
    //
    // A landscape window is short against this portrait plate: at 1440 it can
    // only hold about 42% of the picture's height, so where that window sits is
    // a composition decision, not a detail. Holding the lid's own centre at 33%
    // of the screen put the window at y 0.19..0.61 - her head starts at 0.03, so
    // the establishing frame on every desktop was her torso with the face cut
    // off above the top edge, which is not a photograph of a person working.
    //
    // The window now opens just under the top of her head and the hold is small,
    // so it barely moves as the shot closes: under one per cent of the picture
    // across the whole chapter, where it used to be a pan. On a phone the window
    // is the full height and both values clamp away, so nothing there changes.

    // The phone chapter's progression, measured off its rendered checkpoints as
    // the log of its subject's on-screen width, normalised. This is the shot's
    // rhythm: unhurried but immediately readable, strongest through the middle,
    // settled by 85% while the next chapter takes the frame. Applying it as an
    // exponent gives this camera the same rhythm at its own magnitude.
    const RHYTHM: Array<[number, number]> = [
      [0, 0], [0.15, 0.129], [0.25, 0.212], [0.40, 0.435], [0.55, 0.728],
      [0.65, 0.851], [0.75, 0.906], [0.85, 0.938], [1, 1]
    ];
    // The tail is the one place this departs from the reference. The phone
    // chapter is done moving by 85% because its object has already filled the
    // screen and the work chapter is taking over; here the last stretch is the
    // laptop passing the lens, which has to keep travelling or the shot settles
    // and then simply stops. 0.995 became 0.958, so the final 15% carries real
    // distance instead of four thousandths of it.

    // How much of the frame's width the laptop and hands end up occupying. Past
    // 1 on purpose: the reference lets its subject grow beyond the viewport, and
    // a close shot that stops exactly at the edges reads as a fitted picture.
    //
    // 1.45 rather than 1.29 because of how the eye reads a large subject. The
    // progression below is the reference's, so the two shots complete the same
    // fraction of their travel at the same moment; but the reference's subject
    // starts at 22px and the first beat doubles it, while this one starts at
    // 264px and the same fraction moved it 8%, which fell under the threshold
    // and made the opening read as a still. Widening the whole range puts every
    // interval back above it. On a desktop the resolution clamp binds first, so
    // this changes nothing there.
    // 1.90: the lid finishes about 1.35x the frame's width, so it overruns the
    // edges rather than stopping neatly inside them. The object passes the lens
    // instead of halting in front of it. Where the source cannot honestly carry
    // that, the resolution clamp below binds first and the push stops there.
    // What the plate itself does across the whole chapter. Deliberately small:
    // it is a photograph being held still while something comes out of it.
    const PLATE_PUSH = 1.18;

    // What the laptop does, on its own, independently of the plate. This is the
    // motion the viewer is meant to read, and it is roughly three times the
    // plate's, which is what makes the object separate from the picture rather
    // than ride along inside it.
    //
    // The scale grows the object from its hinge, and the depth is a genuine
    // translation toward the lens: together with the rotation already anchored
    // there, the near edge ends up about 1.4x forward of the far one, which is
    // the parallax that says "in front of" rather than "larger than".
    // Depth is the animation. Scale is what depth looks like.
    //
    // Every previous attempt drove this with raster scale, and every one of them
    // read the same way: a cut-out getting bigger. Enlarging a flat image is not
    // what approaching looks like — approaching means the distance to the lens
    // shrinks, and the growth follows from the perspective divide rather than
    // being applied to the pixels.
    //
    // So the scale is now barely more than a nudge, and the travel is large: the
    // lid crosses most of the way to the camera. That also fixes the softness on
    // its own, because a perspective divide magnifies the near edge far more
    // than the far one, so the picture is never uniformly blown up.
    // THE HINGE STAYS IN HER HANDS; THE LID COMES AT THE LENS.
    //
    // The previous travel drove the whole card to z 1240 against a 1450 lens.
    // Two things went wrong with that, and they are the two the eye was
    // complaining about.
    //
    // First, the hinge itself ended up with a perspective divide of 4.4, so the
    // line her fingers are closed around grew four and a half times while her
    // hand grew 1.18 with the plate. The laptop did not stay in her hands; it
    // left them and her fingers passed through it.
    //
    // Second, and worse, the lid's top edge sits 642 units nearer the lens than
    // the hinge once it has swung 55 degrees. 1240 + 642 is past the viewpoint:
    // at 85% the divide there was 321, and by the end the geometry was BEHIND
    // the camera, which the browser resolves by clipping it. The whole final
    // stretch, the one stretch that is supposed to be the strongest, was being
    // drawn as a clipped wedge. That is the flat, cut-off look.
    //
    // So the travel is now small and the turn does the work. The hinge only
    // reaches a divide of about 1.6 - near enough to the plate's own 1.18 that
    // it stays registered to her hand for the whole chapter - while the top edge
    // reaches 5.6. That difference across a single flat panel IS the third
    // dimension: the near edge sweeps out over the frame while the far edge
    // stays put, which is what a plane tipping toward a lens actually does and
    // what no amount of scaling can imitate.
    const OBJECT_SCALE = 1.30;
    const OBJECT_Z = 560;
    // The last of the approach, spent after the object is already at full size.
    // Card units, so it is scaled into the scene like everything else, and small
    // enough that the near edge stays well clear of the perspective plane.
    // The last of the travel. Kept so the near edge peaks around 490 scene units
    // against a 760 viewpoint: close enough that the object is plainly passing,
    // far enough from the vanishing plane that nothing inverts.
    // The pass. It takes the hinge to 550 and the near edge to 1192 against the
    // 1450 lens, where the divide is climbing steeply: the last fifth of the
    // scroll carries the near edge from 2.8 to 5.6, so the strongest movement of
    // the whole chapter is its final movement. There is still 258 units of
    // clearance to the viewpoint at the very last frame, so nothing clips and
    // nothing inverts - it overruns the frame while still being a solid object.
    const PASS_Z = 165;

    // The four corners the lid occupies in the photograph, measured off it. The
    // card is placed by the projective map that takes its own box to these, so
    // at rest it is indistinguishable from the lid it was rectified out of.
    const LID = [
      [0.0345, 0.2140],
      [0.2455, 0.1585],
      [0.3205, 0.3520],
      [0.1085, 0.3875]
    ];
    const CARD_W = 1200;
    const CARD_H = 784;
    // How far the lid swings, and the sign matters as much as the size.
    //
    // NEGATIVE: the top edge sweeps toward the lens rather than away. Away, the
    // card foreshortens off its own footprint and the photograph's lid appears
    // behind it as a second laptop; toward, perspective enlarges it and it keeps
    // covering the lid it was rectified out of.
    //
    // 55, found by sweeping the real render rather than by argument. Clean at
    // every width through the high fifties; at 62 a sliver of the plate's own
    // lid starts to show at 1920, at 66 it is plain on a phone, and by 72 there
    // are visibly two laptops. This sits inside that limit at every viewport
    // with room to spare, and it is a third more turn than the previous 42.
    const LID_OPEN = -55;


    const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
    const clamp01 = (v: number) => clamp(v, 0, 1);
    const track = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
    const ease = (v: number) => v * v * (3 - 2 * v);

    // The smallest window of the screen's shape that still holds a piece of the
    // picture. One composition, adapted to the viewport rather than redesigned
    // for it: the content is fixed and the window grows in whichever direction
    // the screen is long.
    const fit = (c: { x0: number; x1: number; y0: number; y1: number }, aspect: number) => {
      const k = aspect * IMG_R;
      let ch = Math.max(c.y1 - c.y0, (c.x1 - c.x0) / k);
      let cw = k * ch;
      const shrink = Math.min(1, 1 / cw, 1 / ch);
      return { cw: cw * shrink, ch: ch * shrink };
    };

    // Solves the projective map from the card's own box onto the lid's corners.
    // Eight unknowns, eight equations, solved once: this is placement, not
    // motion, so it never runs during a scroll.
    const placeCard = () => {
      const dst = LID.map(([x, y]) => [x * BASE, y * BASE * IMG_R]);
      const src = [[0, 0], [CARD_W, 0], [CARD_W, CARD_H], [0, CARD_H]];
      const A: number[][] = [];
      const rhs: number[] = [];
      for (let i = 0; i < 4; i++) {
        const [x, y] = src[i];
        const [u, v] = dst[i];
        A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
        rhs.push(u);
        A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
        rhs.push(v);
      }
      for (let i = 0; i < 8; i++) {
        let piv = i;
        for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
        [A[i], A[piv]] = [A[piv], A[i]];
        [rhs[i], rhs[piv]] = [rhs[piv], rhs[i]];
        for (let r = 0; r < 8; r++) {
          if (r === i) continue;
          const f = A[r][i] / A[i][i];
          for (let k = i; k < 8; k++) A[r][k] -= f * A[i][k];
          rhs[r] -= f * rhs[i];
        }
      }
      const g = rhs.map((v, i) => v / A[i][i]);

      // A plain 2D projective map. The z column is 1 because nothing travels in
      // depth inside this transform any more: the lens now sits downstream of
      // it, so the card's approach happens in its own space at its own scale and
      // this matrix only carries the finished image onto the quad. The old sz
      // patch existed to rescale a depth axis that no longer passes through
      // here, and keeping it would silently shrink the travel by a quarter.
      return `matrix3d(${g[0]},${g[3]},0,${g[6]},${g[1]},${g[4]},0,${g[7]},0,0,1,0,${g[2]},${g[5]},0,1)`;
    };

    if (cardPlace) cardPlace.style.setProperty('--lid-place', placeCard());

    this.zone.runOutsideAngular(() => {
      let ticking = false;

      const update = () => {
        ticking = false;

        const rect = stage.getBoundingClientRect();
        const travel = rect.height - window.innerHeight;
        if (travel <= 0) return;

        const p = clamp01(-rect.top / travel);
        const w = window.innerWidth;
        const h = window.innerHeight;

        // THE CAMERA. One eased push-in, and nothing else moves: no pan, no
        // rotation, no reframing. The photograph already carries the laptop at
        // its own angle along her forearm, and the camera comes in along that
        // composition rather than introducing a direction of its own.
        const start = fit(ESTABLISH, w / h);
        // THE PLATE BARELY MOVES. It used to close from 0.56 to 1.47 on a phone,
        // which is the whole photograph zooming: Adi grew, the backdrop rushed
        // forward, and the laptop only looked bigger because everything did. The
        // object's approach now lives on the object, so this is reduced to the
        // gentle drift that keeps the shot alive under it.
        const sharp = (start.cw * NATIVE_W) / w;
        const end = Math.min(PLATE_PUSH, sharp);

        let n = 0;
        for (let i = 1; i < RHYTHM.length; i++) {
          const [pa, na] = RHYTHM[i - 1];
          const [pb, nb] = RHYTHM[i];
          if (p <= pb) { n = na + ((nb - na) * (p - pa)) / (pb - pa); break; }
          n = nb;
        }
        const z = Math.pow(end, n);

        const cw = start.cw / z;
        const ch = start.ch / z;
        const cx = clamp(ANCHOR.x - HOLD.x * cw, 0, 1 - cw);
        const cy = clamp(ANCHOR.y - HOLD.y * ch, 0, 1 - ch);

        // One uniform scale maps that rectangle onto the viewport. There is no
        // second axis to disagree with the first, so the picture cannot stretch
        // and the laptop cannot lose its proportions at any point in the move.
        const s = w / (cw * BASE);
        scene.style.setProperty('--cam-s', s.toFixed(5));
        scene.style.setProperty('--cam-x', `${(-cx * BASE * s).toFixed(1)}px`);
        scene.style.setProperty('--cam-y', `${(-cy * BASE * IMG_R * s).toFixed(1)}px`);

        // THE OPENING. It starts once the approach has made the laptop the
        // subject, and runs to the very end, so the last stretch of the chapter
        // is the screen still coming round rather than a frozen frame.
        if (cardPlace) {
          // Half linear, half smoothstep, from 0.20.
          //
          // Pure linear was the previous attempt and it read as machinery: a
          // constant angular rate has no arc to it, and the eye reads constant
          // as mechanical however smooth the frames are. Pure smoothstep is the
          // opposite failure, spending its first third almost stationary and
          // then dumping the whole turn into the end.
          //
          // Blending them keeps soft ends without a dead middle. The angular
          // rate rises from about 64 degrees per unit of scroll through the
          // early build, peaks near 80 across the strongest stretch, and settles
          // back to about 49 as the lid goes past — an object gathering pace and
          // then carrying its own momentum, rather than a value being animated.
          const t = track(p, 0.20, 1);
          const turn = 0.45 * t + 0.55 * (t * t * (3 - 2 * t));
          const deg = LID_OPEN * turn;

          // The approach. Weighted late on purpose: an object coming toward a
          // lens covers ground slowly while it is far off and then arrives, so
          // the first third is a separation you feel rather than see, and the
          // last third is the object filling the frame. Anchored at the hinge by
          // the transform chain, so it grows out of where it actually sits in
          // the photograph instead of swelling about its own middle.
          // The approach finishes at 0.88, not at 1.
          //
          // Running the growth all the way to the end meant the largest and
          // therefore softest frame of the whole chapter was also the last one,
          // and it simply stopped there. The object now reaches its full size
          // while there is still scroll left, which is what gives the ending
          // somewhere to go.
          // Starting at 0.12 and rising sooner, so the object has visibly begun
          // to separate from the photograph by a third of the way through
          // rather than halfway. The exponent keeps the middle accelerating into
          // the strongest stretch instead of arriving all at once.
          // Close to linear in DISTANCE, which is what makes the apparent motion
          // accelerate on its own: 1/(1 - z/d) climbs faster the nearer the
          // object gets, so an object closing at a steady rate appears to speed
          // up as it arrives. That is the acceleration into the strongest
          // stretch, and it comes from the physics rather than from an easing
          // curve laid on top.
          // Linear in distance now, not shaped. The apparent motion accelerates
          // on its own because 1/(1 - z/d) climbs faster the nearer the object
          // gets, and the previous exponent was pushing travel into the last
          // stretch on top of that: the object crept through the middle and then
          // lunged over the final fifteen per cent. Even distance spreads the
          // crest across 55 to 80, where it belongs.
          // Linear in DISTANCE, from 18%. The acceleration the eye reads is not
          // in this curve and must not be: 1/(1 - z/d) climbs on its own, and
          // steeply, as the object nears the lens. An object closing at a steady
          // rate appears to speed up as it arrives, which is the physics doing
          // the easing. Shaping this as well would double the effect and push
          // all the travel into a lunge at the end, which is what an earlier
          // version did. Starting at 0.18 keeps the first fifth a photograph.
          const near = track(p, 0.18, 0.92);
          cardPlace.style.setProperty('--lid-s', (1 + (OBJECT_SCALE - 1) * near).toFixed(4));

          // And then it passes, by continuing to come at the lens rather than by
          // travelling across it.
          //
          // The first attempt slid the object up and out of frame, and that was
          // plainly wrong the moment it rendered: sliding it away uncovers the
          // laptop still sitting in the photograph underneath, so the chapter
          // ended by revealing the very thing the object was standing in for.
          // Depth cannot do that. The near edge swings closer, the perspective
          // divide widens, and the object overruns the frame while never
          // stopping being the thing in front of the picture.
          // Overlapped with the tail of the approach rather than starting after
          // it, so the two blend into one continuous closing instead of handing
          // over with a step.
          const pass = ease(track(p, 0.78, 1));
          cardPlace.style.setProperty(
            '--lid-z',
            `${(OBJECT_Z * near + PASS_Z * pass).toFixed(1)}px`
          );

          // The same value drives how the lid is lit. As it comes round it
          // catches more of the key light that is already in the photograph and
          // the crease at the hinge deepens, which is the cue that was missing:
          // the surface was holding one flat tone through the whole turn, and a
          // panel that never changes value as it rotates reads as a picture of
          // a panel.
          // A SECOND AXIS, because one is not enough to read as a solid.
          //
          // A panel turning about a single horizontal hinge keystones, but every
          // vertical line in it stays vertical, and the eye reads that as a
          // picture being skewed rather than as an object in a room. The lid in
          // the photograph is already yawed - the quad it was rectified out of
          // is a trapezoid, not a rectangle - so continuing that turn is the
          // motion the photograph itself set up, not a new invention.
          //
          // 15 degrees, about the vertical axis through the hinge, arriving
          // late. It stays small on purpose: enough that the far side falls away
          // and the near side comes round, which is the cue that says solid, and
          // not so much that the card leaves the footprint it has to keep
          // covering. The original lid stays hidden underneath throughout.
          const yaw = -15 * ease(track(p, 0.34, 1));
          cardPlace.style.setProperty('--lid-yaw', `${yaw.toFixed(2)}deg`);

          cardPlace.style.setProperty('--lid-t', turn.toFixed(4));
          cardPlace.style.setProperty('--lid-open', `${deg.toFixed(2)}deg`);
          cardPlace.style.setProperty('--face-lid', Math.abs(deg) < 90 ? '1' : '0');
          cardPlace.style.setProperty('--face-screen', Math.abs(deg) < 90 ? '0' : '1');
        }

        veil.style.setProperty('--bridge-veil', '0');

        // THE HANDOFF. The next chapter is parked below where its margin would
        // put it and rises through the last third of the same scroll, so it is
        // already there to read while the laptop is still filling the frame.
        // The shot is not cut away from; it is covered, the way the phone
        // chapter is covered by the work chapter.
        if (next) {
          const reveal = track(p, 0.52, 0.94);
          next.style.setProperty('--handoff-y', `${((1 - ease(reveal)) * HANDOFF_VH * h / 100).toFixed(1)}px`);
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
