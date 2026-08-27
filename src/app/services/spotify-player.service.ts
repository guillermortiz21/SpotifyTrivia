import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SpotifyAuthService } from './spotify-auth.service';

const CLIP_DURATION_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class SpotifyPlayerService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(SpotifyAuthService);

  private player: Spotify.Player | null = null;
  private deviceId: string | null = null;
  private sdkLoaded = false;
  private playTimer: ReturnType<typeof setTimeout> | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.deviceId) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.connectPlayer();
    return this.initPromise;
  }

  async activateAudio(): Promise<void> {
    await this.initialize();
    await this.player?.activateElement();
  }

  async playTrack(uri: string, durationMs = CLIP_DURATION_MS): Promise<void> {
    await this.initialize();

    if (!this.deviceId) {
      throw new Error('Spotify player is not ready.');
    }

    await this.transferPlayback();
    await this.startPlayback(uri);

    this.clearPlayTimer();
    this.playTimer = setTimeout(() => {
      void this.pause();
    }, durationMs);
  }

  async pause(): Promise<void> {
    this.clearPlayTimer();

    if (!this.deviceId) {
      return;
    }

    const headers = this.authHeaders();
    const url = `${environment.spotify.apiUrl}/me/player/pause?device_id=${this.deviceId}`;

    try {
      await firstValueFrom(this.http.put(url, null, { headers }));
    } catch {
      // Playback may already be stopped.
    }
  }

  disconnect(): void {
    this.clearPlayTimer();
    this.player?.disconnect();
    this.player = null;
    this.deviceId = null;
    this.initPromise = null;
  }

  private async connectPlayer(): Promise<void> {
    await this.loadSdk();

    return new Promise((resolve, reject) => {
      const player = new window.Spotify.Player({
        name: 'Spotify Trivia',
        getOAuthToken: (cb: (token: string) => void) => {
          const token = this.auth.getToken();
          if (token) {
            cb(token);
          }
        },
        volume: 0.8,
      });

      this.player = player;

      player.addListener('ready', (data) => {
        const event = data as Spotify.ReadyEvent;
        this.deviceId = event.device_id;
        void this.transferPlayback().then(
          () => resolve(),
          () => resolve()
        );
      });

      player.addListener('account_error', () => {
        reject(
          new Error(
            'Spotify Premium is required to play full songs. Free accounts cannot use playback.'
          )
        );
      });

      player.addListener('authentication_error', () => {
        reject(new Error('Spotify authentication failed. Please log in again.'));
      });

      player.addListener('initialization_error', (data) => {
        const event = data as { message?: string };
        reject(new Error(event.message ?? 'Failed to initialize Spotify player.'));
      });

      void player.connect().then((success) => {
        if (!success) {
          reject(new Error('Could not connect to Spotify playback.'));
        }
      });
    });
  }

  private async transferPlayback(): Promise<void> {
    if (!this.deviceId) {
      return;
    }

    const headers = this.authHeaders();
    const url = `${environment.spotify.apiUrl}/me/player`;

    await firstValueFrom(
      this.http.put(url, { device_ids: [this.deviceId], play: false }, { headers })
    );
  }

  private async startPlayback(uri: string): Promise<void> {
    if (!this.deviceId) {
      throw new Error('Spotify player is not ready.');
    }

    const headers = this.authHeaders();
    const url = `${environment.spotify.apiUrl}/me/player/play?device_id=${this.deviceId}`;
    const body = { uris: [uri], position_ms: 0 };

    try {
      await firstValueFrom(this.http.put(url, body, { headers }));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        await this.transferPlayback();
        await firstValueFrom(this.http.put(url, body, { headers }));
        return;
      }

      throw this.toPlaybackError(error);
    }
  }

  private toPlaybackError(error: unknown): Error {
    if (error instanceof HttpErrorResponse) {
      const message =
        typeof error.error === 'object' &&
        error.error !== null &&
        'error' in error.error &&
        typeof (error.error as { error?: { message?: string } }).error?.message ===
          'string'
          ? (error.error as { error: { message: string } }).error.message
          : error.message;

      if (error.status === 403) {
        return new Error(
          'Spotify Premium is required to play songs, or playback permission was denied.'
        );
      }

      return new Error(message || 'Could not start playback on Spotify.');
    }

    return error instanceof Error ? error : new Error('Could not start playback.');
  }

  private loadSdk(): Promise<void> {
    if (this.sdkLoaded && window.Spotify) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      if (window.Spotify) {
        this.sdkLoaded = true;
        resolve();
        return;
      }

      const existing = document.querySelector(
        'script[src="https://sdk.scdn.co/spotify-player.js"]'
      );

      if (existing) {
        window.onSpotifyWebPlaybackSDKReady = () => {
          this.sdkLoaded = true;
          resolve();
        };
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      script.onerror = () => reject(new Error('Failed to load Spotify player SDK.'));
      document.body.appendChild(script);

      window.onSpotifyWebPlaybackSDKReady = () => {
        this.sdkLoaded = true;
        resolve();
      };
    });
  }

  private authHeaders(): HttpHeaders {
    const token = this.auth.getToken();
    if (!token) {
      throw new Error('Not authenticated. Please log in with Spotify.');
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private clearPlayTimer(): void {
    if (this.playTimer) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }
  }
}
