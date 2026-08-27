declare namespace Spotify {
  interface Player {
    connect(): Promise<boolean>;
    disconnect(): void;
    activateElement(): Promise<void>;
    addListener(event: string, callback: (data: unknown) => void): void;
    removeListener(event: string, callback?: (data: unknown) => void): void;
  }

  interface PlayerInit {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }

  interface PlaybackInstance {
    Player: new (options: PlayerInit) => Player;
  }

  interface ReadyEvent {
    device_id: string;
  }
}

interface Window {
  Spotify: Spotify.PlaybackInstance;
  onSpotifyWebPlaybackSDKReady: () => void;
}
