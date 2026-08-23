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
  private initHeroParallax(): void {
    const heroBgImg = document.querySelector<HTMLElement>('.hero-bg img');
    const orbs = Array.from(document.querySelectorAll<HTMLElement>('.hero-orb'));

    if (!heroBgImg && orbs.length === 0) return;

    this.zone.runOutsideAngular(() => {
      let ticking = false;

      const onScroll = () => {
        if (!ticking) {
          const id = requestAnimationFrame(() => {
            const scrollY = window.scrollY;
            const heroH = document.querySelector<HTMLElement>('.hero')?.offsetHeight ?? window.innerHeight;

            if (scrollY < heroH * 1.4) {
              const p = scrollY / heroH;

              if (heroBgImg) {
                heroBgImg.style.transform = `scale(0.88) translateY(${p * 3}%)`;
              }

              orbs.forEach((orb, i) => {
                const speed = 0.08;
                const dir = i % 2 === 0 ? 1 : -1;
                orb.style.marginTop = `${scrollY * speed * dir * 0.4}px`;
              });
            }
            ticking = false;
          });
          this.rafIds.push(id);
          ticking = true;
        }
      };

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

  // ─── Laptop bridge into the process chapter (mobile only) ────────────────────
  // The camera pushes in on the laptop she is holding until it fills the frame,
  // then the process chapter takes over. Every value is derived from normalized
  // scroll position, so the move is identical forwards and backwards and there is
  // no state to get stuck in.
  //
  // The scale origin sits on the laptop itself, which is what sells it: the lid
  // holds its place while the room expands past it. A centre-origin scale would
  // read as a plain zoom.
  private initLaptopBridge(): void {
    const stage = document.querySelector<HTMLElement>('.bridge-stage');
    const photo = document.querySelector<HTMLElement>('.bridge-photo');
    const veil = document.querySelector<HTMLElement>('.bridge-veil');
    if (!stage || !photo || !veil) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const track = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

    this.zone.runOutsideAngular(() => {
      let ticking = false;

      const update = () => {
        ticking = false;
        // Off below 768: the stage collapses there and there is nothing to drive.
        if (window.innerWidth >= 768) return;

        const rect = stage.getBoundingClientRect();
        const travel = rect.height - window.innerHeight;
        if (travel <= 0) return;

        const p = clamp01(-rect.top / travel);

        // Slow at first so the photograph reads as a photograph, then the push
        // accelerates as the laptop becomes the subject.
        const push = track(p, 0.08, 0.94);
        photo.style.setProperty('--bridge-scale', (1 + Math.pow(push, 1.7) * 1.9).toFixed(4));

        // The frame gives way only once the laptop already fills it, so the
        // handoff reads as the surface becoming the page.
        photo.style.setProperty('--bridge-opacity', (1 - track(p, 0.74, 0.99)).toFixed(3));
        veil.style.setProperty('--bridge-veil', track(p, 0.70, 0.97).toFixed(3));
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
        const open = track(p, 0.34, 0.97);
        const need = (Math.max(window.innerWidth, window.innerHeight) * 2.4) / 26;
        const scale = emerge * 1.6 + Math.pow(open, 2.1) * need;

        portal.style.setProperty('--portal-scale', scale.toFixed(3));
        portal.style.setProperty('--portal-opacity', emerge > 0 ? '1' : '0');
        // The phone is held at an angle; the portal starts matching it and
        // straightens as it stops being an object and becomes the next chapter.
        portal.style.setProperty('--portal-rot', `${(-18 * (1 - open)).toFixed(2)}deg`);

        if (mark) {
          mark.style.setProperty('--mark-opacity', (1 - track(p, 0.04, 0.24)).toFixed(3));
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
