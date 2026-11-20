import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent, FooterComponent } from './ui/shell';
import { PastBannerComponent } from './ui/basics';

/** Header on top, footer at the very bottom even on short pages. */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, PastBannerComponent],
  template: `
    <div class="app-shell">
      <app-header />
      <app-past-banner />
      <main class="app-main"><router-outlet /></main>
      <app-footer />
    </div>
  `,
})
export class AppComponent {}
