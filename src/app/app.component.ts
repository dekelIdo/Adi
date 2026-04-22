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
          '.section-image',
          '.brand-label',
          '.brand-item',
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

    const getDelayClass = (index: number, max = 5) =>
      `delay-${(index % max) + 1}`;

    heroElements.forEach((target, index) => {
      target.classList.add('reveal', 'reveal-hero', getDelayClass(index, 4));
    });

    const restTargets = targets.filter((target) => !heroElements.includes(target));
    const delayCounters = new Map<string, number>();

    restTargets.forEach((target, index) => {
      const sectionId = target.closest('section')?.id;
      const sectionKey = sectionId ?? 'default';
      const count = delayCounters.get(sectionKey) ?? 0;
      delayCounters.set(sectionKey, count + 1);
      const delayClass = getDelayClass(count);

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
          target.classList.add('reveal', 'reveal-float');
        } else if (sectionId === 'problem') {
          target.classList.add('reveal', 'reveal-rise');
        } else if (sectionId === 'services') {
          target.classList.add('reveal', 'reveal-scale');
        } else if (sectionId === 'process') {
          target.classList.add('reveal', 'reveal-rise');
        } else {
          target.classList.add('reveal', 'reveal-scale');
        }
        target.classList.add(delayClass);
        return;
      }

      if (sectionId === 'insight') {
        target.classList.add('reveal', 'reveal-rise');
      } else if (sectionId === 'solution') {
        target.classList.add('reveal', 'reveal-rise');
      } else if (sectionId === 'about') {
        target.classList.add('reveal', 'reveal-soft');
      } else if (sectionId === 'portfolio' || sectionId === 'testimonials') {
        target.classList.add('reveal', 'reveal-float');
      } else if (sectionId === 'honesty' || sectionId === 'audience') {
        target.classList.add('reveal', 'reveal-soft');
      } else {
        target.classList.add('reveal', 'reveal-soft');
      }

      target.classList.add(delayClass);
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

