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
  private mediaQuery?: MediaQueryList;
  private dotsContainer?: HTMLElement | null;

  ngAfterViewInit(): void {
    if (!('IntersectionObserver' in window)) {
      return;
    }

    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('.packages .card')
    );
    const packageGrid = document.querySelector<HTMLElement>('.packages .package-grid');
    this.dotsContainer = document.querySelector<HTMLElement>('.packages .carousel-dots');

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

    if (packageGrid) {
      this.mediaQuery = window.matchMedia('(max-width: 480px)');
      const handleCarousel = (isMobile: boolean) => {
        cards.forEach((card) => card.classList.remove('is-active'));
        this.carouselObserver?.disconnect();

        if (this.dotsContainer) {
          this.dotsContainer.innerHTML = '';
        }

        if (!isMobile) {
          return;
        }

        if (this.dotsContainer) {
          cards.forEach((_, index) => {
            const dot = document.createElement('span');
            dot.className = 'carousel-dot';
            if (index === 0) {
              dot.classList.add('is-active');
            }
            this.dotsContainer?.appendChild(dot);
          });
        }

        const popularCard =
          packageGrid.querySelector<HTMLElement>('.card-popular') ?? cards[0];

        if (popularCard) {
          popularCard.classList.add('is-active');
          const popularIndex = cards.indexOf(popularCard);
          if (this.dotsContainer) {
            Array.from(this.dotsContainer.children).forEach((dot, index) => {
              dot.classList.toggle('is-active', index === popularIndex);
            });
          }
          popularCard.scrollIntoView({
            behavior: 'auto',
            inline: 'center',
            block: 'nearest'
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
      };

      handleCarousel(this.mediaQuery.matches);
      this.mediaQuery.addEventListener('change', (event) => {
        handleCarousel(event.matches);
      });
    }
  }

  ngOnDestroy(): void {
    this.cardObserver?.disconnect();
    this.carouselObserver?.disconnect();
  }
}

