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
      target.classList.add('reveal', 'reveal-hero');
      target.style.setProperty('--reveal-delay', `${index * 120}ms`);
    });

    const restTargets = targets.filter((target) => !heroElements.includes(target));

    restTargets.forEach((target, index) => {
      const sectionId = target.closest('section')?.id;
      const isCard =
        target.classList.contains('problem-card') ||
        target.classList.contains('contrast-card') ||
        target.classList.contains('about-card') ||
        target.classList.contains('step-card') ||
        target.classList.contains('service-card') ||
        target.classList.contains('testimonial-card') ||
        target.classList.contains('portfolio-card');

      if (isCard) {
        target.classList.add('reveal', 'reveal-scale');
        target.style.setProperty('--reveal-delay', `${(index % 6) * 80}ms`);
        return;
      }

      if (sectionId === 'insight' || sectionId === 'solution') {
        target.classList.add('reveal', 'reveal-rise');
      } else {
        target.classList.add('reveal', 'reveal-soft');
      }

      target.style.setProperty('--reveal-delay', `${(index % 4) * 90}ms`);
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

