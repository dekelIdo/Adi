import { AfterViewInit, Component, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit, OnDestroy {
  private observer?: IntersectionObserver;
  private scrollListener?: () => void;

  ngAfterViewInit(): void {
    this.initScrollReveal();
    this.initHeaderShrink();
  }

  // ─── Scroll reveal ─────────────────────────────────────────────────────────
  private initScrollReveal(): void {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>('.reveal')
    );
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
      { threshold: 0.1, rootMargin: '0px 0px -32px 0px' }
    );
    targets.forEach((t) => this.observer!.observe(t));
  }

  // ─── Header scroll-shrink ──────────────────────────────────────────────────
  // Sets --scrolled: 0 or 1 on :host so CSS can interpolate header size.
  private initHeaderShrink(): void {
    const host = document.querySelector<HTMLElement>('app-root');
    if (!host) return;

    const threshold = 60;
    let scrolled = false;

    const update = () => {
      const isScrolled = window.scrollY > threshold;
      if (isScrolled !== scrolled) {
        scrolled = isScrolled;
        host.style.setProperty('--scrolled', scrolled ? '1' : '0');
      }
    };

    // Run once on init
    update();

    this.scrollListener = update;
    window.addEventListener('scroll', this.scrollListener, { passive: true });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
  }
}
