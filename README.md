# Spotify Trivia

A music trivia game built with Angular. Pick one of your Spotify playlists, listen to a 30-second clip, and guess the song from four title + artist options.

## How it works

1. Log in with Spotify (Authorization Code + PKCE).
2. Select a playlist you own or collaborate on.
3. The app loads all tracks and picks one at random.
4. The first 30 seconds of the song plays via the Spotify Web Playback SDK.
5. Choose the correct song from four shuffled options.

## Requirements

- **Spotify Premium** — required for playback. Free accounts cannot stream via the API.
- **Own or collaborative playlists only** — Spotify's API no longer allows reading tracks from other users' public playlists (as of February 2025). To play trivia on a public playlist, duplicate it in Spotify so you become the owner.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Spotify Developer](https://developer.spotify.com/dashboard) application
- A Spotify Premium account

## Spotify app setup

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and create an app.
2. In **Settings**, add this Redirect URI:
   ```
   http://127.0.0.1:4200/callback
   ```
   > Spotify no longer accepts `localhost`. Use the loopback IP `127.0.0.1` instead. HTTP is allowed for loopback addresses.
3. Copy your **Client ID**.

## Configuration

Open `src/environments/environment.development.ts` and replace the placeholder:

```typescript
clientId: 'YOUR_SPOTIFY_CLIENT_ID',
```

For production builds, update `src/environments/environment.ts` as well.

After changing scopes, log out and log back in so Spotify grants the new permissions.

## Run locally

```bash
npm install
npm start
```

Open [http://127.0.0.1:4200](http://127.0.0.1:4200) (not `localhost` — it must match the redirect URI).

## Build

```bash
npm run build
```

Output is in `dist/spotify-trivia/`.

## Playlist requirements

- The playlist must be one you **own** or are a **collaborator** on.
- At least **4 tracks** are required.
- Supported URL formats:
  - `https://open.spotify.com/playlist/PLAYLIST_ID`
  - `spotify:playlist:PLAYLIST_ID`

## Tech stack

- Angular 19 (standalone components)
- Spotify Web API with PKCE authentication
- Spotify Web Playback SDK for 30-second full-track clips
