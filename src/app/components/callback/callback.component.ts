import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SpotifyAuthService } from '../../services/spotify-auth.service';

@Component({
  selector: 'app-callback',
  imports: [RouterLink],
  template: `
    <div class="callback">
      @if (error) {
        <p class="error">{{ error }}</p>
        <a routerLink="/">Back to home</a>
      } @else {
        <p>Connecting to Spotify...</p>
      }
    </div>
  `,
  styles: `
    .callback {
      text-align: center;
      padding: 4rem 1rem;
      color: var(--text-muted);
    }
    .error {
      color: #ff6b6b;
      margin-bottom: 1rem;
    }
    a {
      color: var(--spotify-green);
    }
  `,
})
export class CallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(SpotifyAuthService);

  error = '';

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    const authError = this.route.snapshot.queryParamMap.get('error');

    if (authError) {
      this.error = 'Spotify authorization was denied.';
      return;
    }

    if (!code) {
      this.error = 'No authorization code received.';
      return;
    }

    void this.auth.handleCallback(code).then(
      () => this.router.navigate(['/']),
      () => {
        this.error = 'Authentication failed. Please try again.';
      }
    );
  }
}
