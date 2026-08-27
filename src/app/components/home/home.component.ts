import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SpotifyAuthService } from '../../services/spotify-auth.service';
import { SpotifyApiService } from '../../services/spotify-api.service';
import { SpotifyPlayerService } from '../../services/spotify-player.service';
import { GameService } from '../../services/game.service';
import { extractPlaylistId } from '../../utils/playlist-url.util';
import { SpotifyPlaylistSummary } from '../../models/track.model';

@Component({
  selector: 'app-home',
  imports: [FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private readonly auth = inject(SpotifyAuthService);
  private readonly api = inject(SpotifyApiService);
  private readonly player = inject(SpotifyPlayerService);
  private readonly game = inject(GameService);
  private readonly router = inject(Router);

  readonly isAuthenticated = this.auth.isAuthenticated;

  playlists: SpotifyPlaylistSummary[] = [];
  selectedPlaylistId = '';
  playlistUrl = '';
  loadingPlaylists = false;
  loading = false;
  error = '';

  ngOnInit(): void {
    if (this.isAuthenticated()) {
      void this.loadPlaylists();
    }
  }

  login(): void {
    this.error = '';
    void this.auth.login();
  }

  logout(): void {
    this.auth.logout();
    this.playlistUrl = '';
    this.selectedPlaylistId = '';
    this.playlists = [];
    this.error = '';
  }

  async loadPlaylists(): Promise<void> {
    this.loadingPlaylists = true;
    try {
      this.playlists = await this.api.getUserPlaylists();
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : 'Could not load your playlists.';
    } finally {
      this.loadingPlaylists = false;
    }
  }

  onPlaylistSelect(): void {
    if (this.selectedPlaylistId) {
      this.playlistUrl = `https://open.spotify.com/playlist/${this.selectedPlaylistId}`;
    }
  }

  async startGame(): Promise<void> {
    this.error = '';

    const playlistId =
      this.selectedPlaylistId || extractPlaylistId(this.playlistUrl);

    if (!playlistId) {
      this.error = 'Please select or enter a valid playlist.';
      return;
    }

    this.loading = true;

    try {
      const tracks = await this.api.getPlaylistTracks(playlistId);
      this.game.setTracks(tracks);

      if (this.game.getPlayableTrackCount() < 4) {
        this.error =
          'Could not load enough songs from this playlist. Make sure you own it or are a collaborator, and that it has at least 4 tracks (not just podcast episodes).';
        return;
      }

      await this.player.initialize();
      await this.router.navigate(['/game']);
    } catch (err) {
      this.error =
        err instanceof Error
          ? err.message
          : 'Could not load the playlist. You can only use playlists you own or collaborate on.';
    } finally {
      this.loading = false;
    }
  }
}
