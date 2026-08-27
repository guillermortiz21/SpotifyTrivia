import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<main class="app-shell"><router-outlet /></main>',
  styleUrl: './app.component.scss',
})
export class AppComponent {}
