import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SpotifyPlaylistSummary, SpotifyTrack } from '../models/track.model';
import { SpotifyAuthService } from './spotify-auth.service';

interface PlaylistItemEntry {
  track?: PlaylistTrackRaw | null;
  item?: PlaylistTrackRaw | null;
}

interface PlaylistTrackRaw {
  id?: string;
  name: string;
  uri?: string;
  type?: string;
  artists?: { name: string }[];
  preview_url?: string | null;
  album?: {
    images: { url: string; height: number; width: number }[];
  };
}

interface PlaylistItemsResponse {
  items: PlaylistItemEntry[];
  total: number;
  offset: number;
  limit: number;
  next: string | null;
}

interface PlaylistListItem {
  id: string;
  name: string;
  collaborative: boolean;
  owner?: { id: string };
  items?: { total: number };
  tracks?: { total: number };
}

interface UserPlaylistsResponse {
  items: PlaylistListItem[];
  total: number;
  offset: number;
  limit: number;
  next: string | null;
}

interface CurrentUserResponse {
  id: string;
}

@Injectable({ providedIn: 'root' })
export class SpotifyApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(SpotifyAuthService);

  async getUserPlaylists(): Promise<SpotifyPlaylistSummary[]> {
    const headers = this.authHeaders();
    const user = await firstValueFrom(
      this.http.get<CurrentUserResponse>(`${environment.spotify.apiUrl}/me`, {
        headers,
      })
    );

    const playlists: PlaylistListItem[] = [];
    const limit = 50;
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    while (offset < total) {
      const response = await firstValueFrom(
        this.http.get<UserPlaylistsResponse>(
          `${environment.spotify.apiUrl}/me/playlists?limit=${limit}&offset=${offset}`,
          { headers }
        )
      );

      playlists.push(...response.items);
      total = response.total;
      offset += response.items.length;

      if (response.items.length === 0) {
        break;
      }
    }

    return playlists
      .filter((p) => p.owner?.id === user.id || p.collaborative)
      .map((p) => ({
        id: p.id,
        name: p.name,
        trackCount: p.items?.total ?? p.tracks?.total ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
    const headers = this.authHeaders();
    const tracks: SpotifyTrack[] = [];
    const limit = 50;
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    while (offset < total) {
      const response = await firstValueFrom(
        this.http.get<PlaylistItemsResponse>(
          `${environment.spotify.apiUrl}/playlists/${playlistId}/items?limit=${limit}&offset=${offset}`,
          { headers }
        )
      );

      for (const entry of response.items) {
        const track = this.toTrack(entry);
        if (track) {
          tracks.push(track);
        }
      }

      total = response.total;
      offset += response.items.length;

      if (response.items.length === 0) {
        break;
      }
    }

    return tracks;
  }

  private toTrack(entry: PlaylistItemEntry): SpotifyTrack | null {
    const raw = entry.item ?? entry.track;
    if (!raw?.id) {
      return null;
    }

    if (raw.type && raw.type !== 'track') {
      return null;
    }

    if (raw.uri?.startsWith('spotify:local:')) {
      return null;
    }

    return {
      id: raw.id,
      name: raw.name,
      uri: raw.uri || `spotify:track:${raw.id}`,
      artists: raw.artists ?? [],
      preview_url: raw.preview_url ?? null,
      album: raw.album ?? { images: [] },
    };
  }

  private authHeaders(): HttpHeaders {
    const token = this.auth.getToken();
    if (!token) {
      throw new Error('Not authenticated. Please log in with Spotify.');
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
