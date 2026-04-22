import { AfterViewInit, Component, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit, OnDestroy {
  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(
        [
          '.hero-content > *',
          '.hero-media',
          '.section-title',
          '.problem-card',
          '.contrast-card',
          '.about-card',
          '.step-card',
          '.service-card',
          '.testimonial-card',
          '.portfolio-card',
          '.contact-form',
          '.checklist',
          '.contact-list',
          '.faq-list details'
        ].join(',')
      )
    );

    if (targets.length === 0) {
      return;
    }

    const heroElements = Array.from(
      document.querySelectorAll<HTMLElement>('.hero-content > *, .hero-media')
    );

    heroElements.forEach((target, index) => {
      target.classList.add('reveal', 'reveal-hero', 'reveal-slow');
      target.style.setProperty('--reveal-delay', `${index * 120}ms`);
    });

    const restTargets = targets.filter((target) => !heroElements.includes(target));
    const delayCounters = new Map<string, number>();

    restTargets.forEach((target, index) => {
      const sectionId = target.closest('section')?.id;
      const sectionKey = sectionId ?? 'default';
      const baseDelay =
        sectionId === 'insight' || sectionId === 'services'
          ? 120
          : sectionId === 'solution' || sectionId === 'process'
            ? 90
            : sectionId === 'portfolio' || sectionId === 'testimonials'
              ? 80
              : 70;
      const count = delayCounters.get(sectionKey) ?? 0;
      delayCounters.set(sectionKey, count + 1);
      const delay = count * baseDelay;

      const isCard =
        target.classList.contains('problem-card') ||
        target.classList.contains('contrast-card') ||
        target.classList.contains('about-card') ||
        target.classList.contains('step-card') ||
        target.classList.contains('service-card') ||
        target.classList.contains('testimonial-card') ||
        target.classList.contains('portfolio-card');

      if (isCard) {
        if (sectionId === 'portfolio' || sectionId === 'testimonials') {
          target.classList.add('reveal', 'reveal-float', 'reveal-tight');
        } else if (sectionId === 'problem') {
          target.classList.add('reveal', 'reveal-rise', 'reveal-slow');
        } else if (sectionId === 'services') {
          target.classList.add('reveal', 'reveal-scale', 'reveal-tight');
        } else if (sectionId === 'process') {
          target.classList.add('reveal', 'reveal-rise', 'reveal-tight');
        } else {
          target.classList.add('reveal', 'reveal-scale', 'reveal-delay');
        }

        target.style.setProperty('--reveal-delay', `${delay}ms`);
        return;
      }

      if (sectionId === 'insight') {
        target.classList.add('reveal', 'reveal-rise', 'reveal-slow');
      } else if (sectionId === 'solution') {
        target.classList.add('reveal', 'reveal-rise', 'reveal-tight');
      } else if (sectionId === 'about') {
        target.classList.add('reveal', 'reveal-soft', 'reveal-delay');
      } else if (sectionId === 'portfolio' || sectionId === 'testimonials') {
        target.classList.add('reveal', 'reveal-float', 'reveal-tight');
      } else if (sectionId === 'honesty' || sectionId === 'audience') {
        target.classList.add('reveal', 'reveal-soft', 'reveal-slow');
      } else {
        target.classList.add('reveal', 'reveal-soft', 'reveal-delay');
      }

      target.style.setProperty('--reveal-delay', `${delay}ms`);
    });

    if (!('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-visible'));
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
      { threshold: 0.2 }
    );

    targets.forEach((target) => this.observer?.observe(target));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}

