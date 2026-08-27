export const environment = {
  production: true,
  spotify: {
    clientId: 'YOUR_SPOTIFY_CLIENT_ID',
    redirectUri: 'http://127.0.0.1:4200/callback',
    scopes: [
      'playlist-read-private',
      'playlist-read-collaborative',
      'streaming',
      'user-read-email',
      'user-read-private',
      'user-modify-playback-state',
    ],
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    apiUrl: 'https://api.spotify.com/v1',
  },
};
