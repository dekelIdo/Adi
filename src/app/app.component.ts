import { AfterViewInit, Component, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit, OnDestroy {
  private cardObserver?: IntersectionObserver;
  private carouselObserver?: IntersectionObserver;
  private heroObserver?: IntersectionObserver;
  private revealObserver?: IntersectionObserver;
  private swipeTeaseObserver?: IntersectionObserver;
  private swipeTeaseTargets: HTMLElement[] = [];
  private swipeTeaseInView = new Set<HTMLElement>();
  private swipeTeaseScrollRaf?: number;
  private swipeTeaseLastY = 0;
  private swipeTeaseLastDirection: 'up' | 'down' | 'none' = 'none';
  private swipeTeaseLastTime = 0;
  private swipeTeaseOnScroll?: () => void;
  private mediaQuery?: MediaQueryList;
  private dotsContainer?: HTMLElement | null;
  private clientsAutoplayId?: number;
  private clientsScrollRaf?: number;
  private clientsTrack?: HTMLElement | null;
  private clientsSlides: HTMLElement[] = [];
  private clientsDots?: HTMLElement | null;
  private clientsPrev?: HTMLButtonElement | null;
  private clientsNext?: HTMLButtonElement | null;
  private clientsDragging = false;
  private clientsDragStartX = 0;
  private clientsDragStartScroll = 0;
  private packageCardClickHandlers = new Map<HTMLElement, (event: MouseEvent) => void>();

  ngAfterViewInit(): void {
    const supportsIntersectionObserver = 'IntersectionObserver' in window;

    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('.packages .card')
    );
    const packageGrid = document.querySelector<HTMLElement>('.packages .package-grid');
    this.dotsContainer = document.querySelector<HTMLElement>('.packages .carousel-dots');

    if (supportsIntersectionObserver) {
      this.cardObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const target = entry.target as HTMLElement;
              target.classList.add('is-animated');
              requestAnimationFrame(() => {
                target.classList.add('is-inview');
              });
              observer.unobserve(entry.target);
            }
          });
        },
        {
          threshold: 0.2
        }
      );

      cards.forEach((card) => this.cardObserver?.observe(card));
    }

    if (packageGrid) {
      this.mediaQuery = window.matchMedia('(max-width: 767px)');
      const handleCarousel = (isMobile: boolean) => {
        cards.forEach((card) => card.classList.remove('is-active'));
        this.carouselObserver?.disconnect();
        this.packageCardClickHandlers.forEach((handler, card) => {
          card.removeEventListener('click', handler);
        });
        this.packageCardClickHandlers.clear();

        if (this.dotsContainer) {
          this.dotsContainer.innerHTML = '';
        }

        if (!isMobile) {
          return;
        }

        const popularCard =
          packageGrid.querySelector<HTMLElement>('.card-popular') ?? cards[0];
        const popularIndex = popularCard ? cards.indexOf(popularCard) : 0;

        if (this.dotsContainer) {
          cards.forEach((_, index) => {
            const dot = document.createElement('span');
            dot.className = 'carousel-dot';
            dot.classList.toggle('is-active', index === popularIndex);
            this.dotsContainer?.appendChild(dot);
          });
        }

        if (popularCard) {
          popularCard.classList.add('is-active');
          if (this.dotsContainer) {
            Array.from(this.dotsContainer.children).forEach((dot, index) => {
              dot.classList.toggle('is-active', index === popularIndex);
            });
          }
          requestAnimationFrame(() => {
            const rect = packageGrid.getBoundingClientRect();
            if (rect.top < 0) {
              window.scrollTo({ top: 0, behavior: 'auto' });
            }
            packageGrid.scrollTo({
              left:
                popularCard.offsetLeft -
                (packageGrid.clientWidth - popularCard.offsetWidth) / 2,
              behavior: 'auto'
            });
          });
        }

        this.carouselObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const target = entry.target as HTMLElement;
                cards.forEach((card) => card.classList.remove('is-active'));
                target.classList.add('is-active');
                const activeIndex = cards.indexOf(target);
                if (this.dotsContainer) {
                  Array.from(this.dotsContainer.children).forEach((dot, index) => {
                    dot.classList.toggle('is-active', index === activeIndex);
                  });
                }
              }
            });
          },
          {
            root: packageGrid,
            threshold: 0.6
          }
        );

        cards.forEach((card) => this.carouselObserver?.observe(card));

        cards.forEach((card, index) => {
          const handler = () => {
            cards.forEach((item) => item.classList.remove('is-active'));
            card.classList.add('is-active');
            if (this.dotsContainer) {
              Array.from(this.dotsContainer.children).forEach((dot, dotIndex) => {
                dot.classList.toggle('is-active', dotIndex === index);
              });
            }
            requestAnimationFrame(() => {
              packageGrid.scrollTo({
                left:
                  card.offsetLeft -
                  (packageGrid.clientWidth - card.offsetWidth) / 2,
                behavior: 'smooth'
              });
            });
          };
          card.addEventListener('click', handler);
          this.packageCardClickHandlers.set(card, handler);
        });
      };

      handleCarousel(this.mediaQuery.matches);
      this.mediaQuery.addEventListener('change', (event) => {
        handleCarousel(event.matches);
      });
    }

    this.initHeroEntrance();
    this.initScrollReveals(supportsIntersectionObserver);
    this.initClientsCarousel();
    this.initSwipeTease(supportsIntersectionObserver);
  }

  ngOnDestroy(): void {
    this.cardObserver?.disconnect();
    this.carouselObserver?.disconnect();
    this.heroObserver?.disconnect();
    this.revealObserver?.disconnect();
    this.swipeTeaseObserver?.disconnect();
    if (this.swipeTeaseOnScroll) {
      window.removeEventListener('scroll', this.swipeTeaseOnScroll);
    }
    if (this.swipeTeaseScrollRaf) {
      cancelAnimationFrame(this.swipeTeaseScrollRaf);
    }
    this.cleanupClientsCarousel();
  }

  private initHeroEntrance(): void {
    const hero = document.querySelector<HTMLElement>('.hero');
    if (!hero) {
      return;
    }
    const heroTargets = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.hero .hero-ragga-font-container, .hero .hero-title-name, .hero .hero-lead, .hero .card-divider-blue, .hero .hero-lead-highlight-sub, .hero .hero-actions, .hero .hero-media'
      )
    );
    heroTargets.forEach((target, index) => {
      target.setAttribute('data-animate', 'hero');
      target.style.setProperty('--hero-delay', `${index * 90}ms`);
    });
    const supportsIntersectionObserver = 'IntersectionObserver' in window;
    if (!supportsIntersectionObserver) {
      heroTargets.forEach((target) => target.classList.add('is-inview'));
      return;
    }

    this.heroObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            heroTargets.forEach((target) => target.classList.add('is-inview'));
            observer.disconnect();
          }
        });
      },
      {
        threshold: 0.35
      }
    );

    this.heroObserver.observe(hero);
  }

  private initScrollReveals(supportsIntersectionObserver: boolean): void {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.about, .packages, .clients, .testimonials, .contact'
      )
    );
    if (sections.length === 0) {
      return;
    }

    const revealItems: HTMLElement[] = [];
    sections.forEach((section) => {
      const items = Array.from(
        section.querySelectorAll<HTMLElement>(
          '.section-title, .about-content, .packages-ragga-container, .package-grid, .testimonial-media, .client-carousel, .client-slide, .contact-card'
        )
      );
      items.forEach((item, index) => {
        item.classList.add('reveal-item');
        item.style.setProperty('--reveal-delay', `${index * 90}ms`);
        revealItems.push(item);
      });
    });

    if (!supportsIntersectionObserver) {
      revealItems.forEach((item) => item.classList.add('is-revealed'));
      return;
    }

    this.revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.2
      }
    );

    revealItems.forEach((item) => this.revealObserver?.observe(item));
  }

  private initSwipeTease(supportsIntersectionObserver: boolean): void {
    this.swipeTeaseTargets = Array.from(
      document.querySelectorAll<HTMLElement>('.package-grid, .client-carousel-track')
    );
    if (this.swipeTeaseTargets.length === 0) {
      return;
    }

    this.swipeTeaseTargets.forEach((target) => {
      target.setAttribute('data-animate', 'swipe');
    });

    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotionQuery.matches) {
      return;
    }

    if (!supportsIntersectionObserver) {
      this.swipeTeaseTargets.forEach((target) => target.classList.add('is-inview'));
      return;
    }

    this.swipeTeaseObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            target.classList.add('is-inview');
            this.swipeTeaseInView.add(target);
            this.triggerSwipeTease(target);
          } else {
            const target = entry.target as HTMLElement;
            target.classList.remove('is-inview');
            this.swipeTeaseInView.delete(target);
          }
        });
      },
      {
        threshold: 0.3
      }
    );

    this.swipeTeaseTargets.forEach((target) => this.swipeTeaseObserver?.observe(target));

    this.swipeTeaseLastY = window.scrollY;
    this.swipeTeaseOnScroll = () => {
      if (this.swipeTeaseScrollRaf) {
        cancelAnimationFrame(this.swipeTeaseScrollRaf);
      }
      this.swipeTeaseScrollRaf = requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const direction: 'up' | 'down' | 'none' =
          currentY > this.swipeTeaseLastY ? 'down' : currentY < this.swipeTeaseLastY ? 'up' : 'none';
        this.swipeTeaseLastY = currentY;

        if (direction === 'none') {
          return;
        }

        const now = Date.now();
        const directionChanged = direction !== this.swipeTeaseLastDirection;
        if (directionChanged && now - this.swipeTeaseLastTime > 1200) {
          this.swipeTeaseLastTime = now;
          this.swipeTeaseLastDirection = direction;
          this.swipeTeaseInView.forEach((target) => {
            this.triggerSwipeTease(target);
          });
        } else if (directionChanged) {
          this.swipeTeaseLastDirection = direction;
        }
      });
    };

    window.addEventListener('scroll', this.swipeTeaseOnScroll, { passive: true });
  }

  private triggerSwipeTease(target: HTMLElement): void {
    target.classList.remove('is-swipe-tease');
    void target.offsetWidth;
    target.classList.add('is-swipe-tease');
    const onEnd = () => {
      target.classList.remove('is-swipe-tease');
    };
    target.addEventListener('animationend', onEnd, { once: true });
  }

  private initClientsCarousel(): void {
    this.clientsTrack = document.querySelector<HTMLElement>('.client-carousel-track');
    if (!this.clientsTrack) {
      return;
    }
    this.clientsSlides = Array.from(
      this.clientsTrack.querySelectorAll<HTMLElement>('.client-slide')
    );
    this.clientsDots = document.querySelector<HTMLElement>('.clients-dots');
    this.clientsPrev = document.querySelector<HTMLButtonElement>(
      '.client-carousel .carousel-arrow.prev'
    );
    this.clientsNext = document.querySelector<HTMLButtonElement>(
      '.client-carousel .carousel-arrow.next'
    );

    if (this.clientsDots) {
      this.clientsDots.innerHTML = '';
      this.clientsSlides.forEach((_, index) => {
        const dot = document.createElement('span');
        dot.className = 'carousel-dot';
        if (index === 0) {
          dot.classList.add('is-active');
        }
        this.clientsDots?.appendChild(dot);
      });
    }

    const onPrev = () => this.scrollClientsBy(-1);
    const onNext = () => this.scrollClientsBy(1);
    this.clientsPrev?.addEventListener('click', onPrev);
    this.clientsNext?.addEventListener('click', onNext);

    const onScroll = () => {
      if (this.clientsScrollRaf) {
        cancelAnimationFrame(this.clientsScrollRaf);
      }
      this.clientsScrollRaf = requestAnimationFrame(() => {
        this.updateClientsActiveDot();
      });
    };
    this.clientsTrack.addEventListener('scroll', onScroll, { passive: true });

    const onMouseDown = (event: MouseEvent) => {
      if (!this.clientsTrack) {
        return;
      }
      this.clientsDragging = true;
      this.clientsTrack.classList.add('is-dragging');
      this.clientsDragStartX = event.pageX;
      this.clientsDragStartScroll = this.clientsTrack.scrollLeft;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!this.clientsTrack || !this.clientsDragging) {
        return;
      }
      const delta = event.pageX - this.clientsDragStartX;
      this.clientsTrack.scrollLeft = this.clientsDragStartScroll - delta;
    };

    const stopDrag = () => {
      if (!this.clientsTrack) {
        return;
      }
      this.clientsDragging = false;
      this.clientsTrack.classList.remove('is-dragging');
    };

    this.clientsTrack.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stopDrag);
    this.clientsTrack.addEventListener('mouseleave', stopDrag);

    const onEnter = () => this.pauseClientsAutoplay();
    const onLeave = () => this.startClientsAutoplay();
    this.clientsTrack.addEventListener('mouseenter', onEnter);
    this.clientsTrack.addEventListener('mouseleave', onLeave);
    this.clientsTrack.addEventListener('touchstart', onEnter, { passive: true });
    this.clientsTrack.addEventListener('touchend', onLeave);

    this.startClientsAutoplay();

    this.cleanupClientsCarousel = () => {
      this.pauseClientsAutoplay();
      this.clientsPrev?.removeEventListener('click', onPrev);
      this.clientsNext?.removeEventListener('click', onNext);
      this.clientsTrack?.removeEventListener('scroll', onScroll);
      this.clientsTrack?.removeEventListener('mouseenter', onEnter);
      this.clientsTrack?.removeEventListener('mouseleave', onLeave);
      this.clientsTrack?.removeEventListener('touchstart', onEnter);
      this.clientsTrack?.removeEventListener('touchend', onLeave);
      this.clientsTrack?.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stopDrag);
      this.clientsTrack?.removeEventListener('mouseleave', stopDrag);
      if (this.clientsScrollRaf) {
        cancelAnimationFrame(this.clientsScrollRaf);
      }
    };
  }

  private cleanupClientsCarousel = (): void => {
    return;
  };

  private scrollClientsBy(direction: number): void {
    if (!this.clientsTrack || this.clientsSlides.length === 0) {
      return;
    }
    const slide = this.clientsSlides[0];
    const slideLeft = slide.getBoundingClientRect().width;
    const gapValue = getComputedStyle(this.clientsTrack).gap || '0px';
    const gap = parseFloat(gapValue);
    const step = slideLeft + gap;
    this.clientsTrack.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  private updateClientsActiveDot(): void {
    if (!this.clientsTrack || !this.clientsDots || this.clientsSlides.length === 0) {
      return;
    }
    const trackCenter = this.clientsTrack.scrollLeft + this.clientsTrack.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    this.clientsSlides.forEach((slide, index) => {
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const distance = Math.abs(trackCenter - slideCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    Array.from(this.clientsDots.children).forEach((dot, index) => {
      dot.classList.toggle('is-active', index === closestIndex);
    });
  }

  private startClientsAutoplay(): void {
    if (!this.clientsTrack || this.clientsSlides.length < 2) {
      return;
    }
    if (this.clientsAutoplayId) {
      window.clearInterval(this.clientsAutoplayId);
    }
    this.clientsAutoplayId = window.setInterval(() => {
      this.scrollClientsBy(1);
    }, 5000);
  }

  private pauseClientsAutoplay(): void {
    if (this.clientsAutoplayId) {
      window.clearInterval(this.clientsAutoplayId);
    }
  }
}

