export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  artists: { name: string }[];
  preview_url: string | null;
  album: {
    images: { url: string; height: number; width: number }[];
  };
}

export interface TrackOption {
  id: string;
  title: string;
  artist: string;
}

export interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  trackCount: number;
}
