import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../environments/environment';

const CODE_VERIFIER_KEY = 'spotify_code_verifier';
const ACCESS_TOKEN_KEY = 'spotify_access_token';
const TOKEN_EXPIRY_KEY = 'spotify_token_expiry';

@Injectable({ providedIn: 'root' })
export class SpotifyAuthService {
  private readonly accessToken = signal<string | null>(this.loadToken());

  readonly isAuthenticated = computed(() => !!this.accessToken());

  getToken(): string | null {
    const token = this.accessToken();
    const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);

    if (token && expiry && Date.now() < Number(expiry)) {
      return token;
    }

    this.clearSession();
    return null;
  }

  async login(): Promise<void> {
    const verifier = this.generateCodeVerifier();
    sessionStorage.setItem(CODE_VERIFIER_KEY, verifier);

    const challenge = await this.generateCodeChallenge(verifier);

    const params = new URLSearchParams({
      client_id: environment.spotify.clientId,
      response_type: 'code',
      redirect_uri: environment.spotify.redirectUri,
      scope: environment.spotify.scopes.join(' '),
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });

    window.location.href = `${environment.spotify.authUrl}?${params}`;
  }

  async handleCallback(code: string): Promise<void> {
    const verifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
    if (!verifier) {
      throw new Error('Missing PKCE verifier. Please try logging in again.');
    }

    const body = new URLSearchParams({
      client_id: environment.spotify.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: environment.spotify.redirectUri,
      code_verifier: verifier,
    });

    const response = await fetch(environment.spotify.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error('Failed to authenticate with Spotify.');
    }

    const data = await response.json();
    this.storeToken(data.access_token, data.expires_in);
    sessionStorage.removeItem(CODE_VERIFIER_KEY);
  }

  logout(): void {
    this.clearSession();
    this.accessToken.set(null);
  }

  private storeToken(token: string, expiresIn: number): void {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
    this.accessToken.set(token);
  }

  private loadToken(): string | null {
    const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);

    if (token && expiry && Date.now() < Number(expiry)) {
      return token;
    }

    return null;
  }

  private clearSession(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
    sessionStorage.removeItem(CODE_VERIFIER_KEY);
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(64);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hash = new Uint8Array(hashBuffer);
    return btoa(String.fromCharCode(...hash))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
