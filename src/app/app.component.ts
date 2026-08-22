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
    this.initPortfolioReel();
    this.initResultsReel();
    this.initSectionProgress();
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

  // ─── Portfolio infinite reel — pure JS rAF marquee with full drag/touch ──
  // Replaces CSS animation: gives precise control, seamless loop, drag scrubbing.
  private initPortfolioReel(): void {
    const outer = document.querySelector<HTMLElement>('.portfolio-reel-outer');
    const track = document.querySelector<HTMLElement>('.portfolio-reel-track');
    if (!outer || !track) return;

    // Remove CSS animation — JS handles everything
    track.style.animation = 'none';

    this.zone.runOutsideAngular(() => {
      const SPEED = 0.72;           // px per frame auto-scroll (cinematic pace)
      const FRICTION = 0.90;        // momentum decay after drag release

      let offset = 0;
      let isDragging = false;
      let isHovered = false;
      let isPaused = false;
      let dragStartX = 0;
      let dragOffsetStart = 0;
      let velocity = 0;
      let prevX = 0;
      let resumeTimer: ReturnType<typeof setTimeout>;

      // Seamless loop: when we've scrolled one full set (-50% of track), reset
      const clampOffset = () => {
        const half = track.scrollWidth / 2;
        if (-offset >= half) offset += half;
        if (offset > 0) offset -= half;
      };

      const tick = () => {
        if (!isDragging && !isPaused) {
          if (Math.abs(velocity) > 0.15) {
            offset += velocity;
            velocity *= FRICTION;
          }
          offset -= isHovered ? SPEED * 0.35 : SPEED;
          clampOffset();
          track.style.transform = `translateX(${offset}px)`;
        }
        const id = requestAnimationFrame(tick);
        this.rafIds.push(id);
      };

      tick();

      outer.addEventListener('mouseenter', () => {
        isHovered = true;
        isPaused = true;
      }, { passive: true });
      outer.addEventListener('mouseleave', () => {
        isHovered = false;
        isPaused = false;
        if (isDragging) {
          isDragging = false;
          outer.style.cursor = 'grab';
        }
        velocity = 0;
      }, { passive: true });

      outer.addEventListener('mousedown', (e: MouseEvent) => {
        isDragging = true;
        isPaused = true;
        isHovered = true;
        dragStartX = e.clientX;
        dragOffsetStart = offset;
        prevX = e.clientX;
        velocity = 0;
        outer.style.cursor = 'grabbing';
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e: MouseEvent) => {
        if (!isDragging) return;
        velocity = e.clientX - prevX;
        prevX = e.clientX;
        offset = dragOffsetStart + (e.clientX - dragStartX);
        clampOffset();
        track.style.transform = `translateX(${offset}px)`;
      }, { passive: true });

      window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        isPaused = false;
        outer.style.cursor = 'grab';
      });

      outer.addEventListener('touchstart', (e: TouchEvent) => {
        isDragging = true;
        isPaused = true;
        isHovered = true;
        dragStartX = e.touches[0].clientX;
        dragOffsetStart = offset;
        prevX = e.touches[0].clientX;
        velocity = 0;
        clearTimeout(resumeTimer);
      }, { passive: true });

      outer.addEventListener('touchmove', (e: TouchEvent) => {
        if (!isDragging) return;
        velocity = e.touches[0].clientX - prevX;
        prevX = e.touches[0].clientX;
        offset = dragOffsetStart + (e.touches[0].clientX - dragStartX);
        clampOffset();
        track.style.transform = `translateX(${offset}px)`;
      }, { passive: true });

      outer.addEventListener('touchend', () => {
        isDragging = false;
        isPaused = false;
        resumeTimer = setTimeout(() => {
          isHovered = false;
          velocity = 0;
        }, 400);
      }, { passive: true });

      outer.addEventListener('touchcancel', () => {
        isDragging = false;
        isHovered = false;
        isPaused = false;
        velocity = 0;
      }, { passive: true });

      const cards = track.querySelectorAll<HTMLElement>('.reel-card');
      const centerObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting || entry.intersectionRatio < 0.52) return;
            cards.forEach((c) => c.classList.remove('reel-card--center'));
            entry.target.classList.add('reel-card--center');
          });
        },
        { root: outer, threshold: [0.52, 0.65, 0.8] }
      );
      cards.forEach((c) => centerObs.observe(c));
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

  // ─── Results infinite reel — same rAF marquee as portfolio ──────────────
  private initResultsReel(): void {
    const outer = document.querySelector<HTMLElement>('.results-outer');
    const track = document.querySelector<HTMLElement>('.results-rail');
    if (!outer || !track) return;

    this.zone.runOutsideAngular(() => {
      const SPEED = 0.55;            // slightly slower than portfolio for differentiation
      const FRICTION = 0.90;

      let offset = 0;
      let isDragging = false;
      let isHovered = false;
      let isPaused = false;
      let dragStartX = 0;
      let dragOffsetStart = 0;
      let velocity = 0;
      let prevX = 0;
      let resumeTimer: ReturnType<typeof setTimeout>;

      const clampOffset = () => {
        const half = track.scrollWidth / 2;
        if (-offset >= half) offset += half;
        if (offset > 0) offset -= half;
      };

      const tick = () => {
        if (!isDragging && !isPaused) {
          if (Math.abs(velocity) > 0.15) {
            offset += velocity;
            velocity *= FRICTION;
          }
          offset -= isHovered ? SPEED * 0.25 : SPEED;
          clampOffset();
          track.style.transform = `translateX(${offset}px)`;
        }
        const id = requestAnimationFrame(tick);
        this.rafIds.push(id);
      };

      tick();

      outer.addEventListener('mouseenter', () => {
        isHovered = true;
        isPaused = true;
      }, { passive: true });
      outer.addEventListener('mouseleave', () => {
        isHovered = false;
        isPaused = false;
        if (isDragging) { isDragging = false; outer.style.cursor = 'grab'; }
        velocity = 0;
      }, { passive: true });

      outer.addEventListener('mousedown', (e: MouseEvent) => {
        isDragging = true; isHovered = true; isPaused = true;
        dragStartX = e.clientX; dragOffsetStart = offset;
        prevX = e.clientX; velocity = 0;
        outer.style.cursor = 'grabbing';
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e: MouseEvent) => {
        if (!isDragging) return;
        velocity = e.clientX - prevX;
        prevX = e.clientX;
        offset = dragOffsetStart + (e.clientX - dragStartX);
        clampOffset();
        track.style.transform = `translateX(${offset}px)`;
      }, { passive: true });

      window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        isPaused = false;
        outer.style.cursor = 'grab';
      });

      outer.addEventListener('touchstart', (e: TouchEvent) => {
        isDragging = true; isHovered = true; isPaused = true;
        dragStartX = e.touches[0].clientX; dragOffsetStart = offset;
        prevX = e.touches[0].clientX; velocity = 0;
        clearTimeout(resumeTimer);
      }, { passive: true });

      outer.addEventListener('touchmove', (e: TouchEvent) => {
        if (!isDragging) return;
        velocity = e.touches[0].clientX - prevX;
        prevX = e.touches[0].clientX;
        offset = dragOffsetStart + (e.touches[0].clientX - dragStartX);
        clampOffset();
        track.style.transform = `translateX(${offset}px)`;
      }, { passive: true });

      outer.addEventListener('touchend', () => {
        isDragging = false;
        isPaused = false;
        resumeTimer = setTimeout(() => { isHovered = false; velocity = 0; }, 800);
      }, { passive: true });

      outer.addEventListener('touchcancel', () => {
        isDragging = false; isHovered = false; isPaused = false; velocity = 0;
      }, { passive: true });
    });
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.headerThemeObserver?.disconnect();
    this.rafIds.forEach((id) => cancelAnimationFrame(id));
    this.scrollListeners.forEach((fn) => {
      window.removeEventListener('scroll', fn);
      window.removeEventListener('resize', fn);
    });
  }
}
