import { Injectable } from '@angular/core';
import { SpotifyTrack, TrackOption } from '../models/track.model';
import { QuizQuestion } from '../models/quiz-question.model';
import { shuffle } from '../utils/shuffle.util';
import { PlayerCount } from '../models/player.model';

const SESSION_KEY = 'spotify-trivia-session';

interface StoredSession {
  sessionId: string;
  tracks: SpotifyTrack[];
  playerCount: PlayerCount;
  playerNames: [string, string];
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private tracks: SpotifyTrack[] = [];
  private playerCount: PlayerCount = 1;
  private playerNames: [string, string] = ['Player 1', 'Player 2'];
  private sessionId = '';

  setTracks(tracks: SpotifyTrack[]): void {
    this.tracks = tracks;
  }

  configureMatch(playerCount: PlayerCount, playerNames: [string, string]): void {
    this.playerCount = playerCount;
    this.playerNames = [
      playerNames[0].trim() || 'Player 1',
      playerNames[1].trim() || 'Player 2',
    ];
    this.sessionId =
      playerCount === 2 ? crypto.randomUUID() : '';
  }

  getPlayerCount(): PlayerCount {
    return this.playerCount;
  }

  getPlayerNames(): [string, string] {
    return this.playerNames;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  persistSession(): void {
    if (this.playerCount !== 2 || this.tracks.length < 4) {
      return;
    }

    const payload: StoredSession = {
      sessionId: this.sessionId,
      tracks: this.tracks,
      playerCount: this.playerCount,
      playerNames: this.playerNames,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }

  loadSession(): boolean {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return false;
    }

    try {
      const data = JSON.parse(raw) as StoredSession;
      if (!data.tracks || data.tracks.length < 4 || data.playerCount !== 2) {
        return false;
      }
      this.tracks = data.tracks;
      this.playerCount = data.playerCount;
      this.playerNames = data.playerNames;
      this.sessionId = data.sessionId;
      return true;
    } catch {
      return false;
    }
  }

  getPlayableTrackCount(): number {
    return this.tracks.length;
  }

  generateQuestion(excludeIds: string[] = []): QuizQuestion {
    if (this.tracks.length < 4) {
      throw new Error('This playlist needs at least 4 songs.');
    }

    const unused = this.tracks.filter((t) => !excludeIds.includes(t.id));
    const correctPool = unused.length > 0 ? unused : this.tracks;
    const correctTrack =
      correctPool[Math.floor(Math.random() * correctPool.length)];

    const distractorPool = this.tracks.filter((t) => t.id !== correctTrack.id);
    const distractors = shuffle(distractorPool).slice(0, 3);

    const options = shuffle([
      this.toTrackOption(correctTrack),
      ...distractors.map((t) => this.toTrackOption(t)),
    ]);

    return {
      correctTrack: this.toTrackOption(correctTrack),
      options,
      trackUri: correctTrack.uri,
    };
  }

  private toTrackOption(track: SpotifyTrack): TrackOption {
    return {
      id: track.id,
      title: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
    };
  }
}
