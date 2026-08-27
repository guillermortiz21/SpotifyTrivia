import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { VersusLayout, PlayerView } from '../models/player.model';
import { QuizQuestion } from '../models/quiz-question.model';

export interface GameSnapshot {
  round: number;
  question: QuizQuestion | null;
  timeLeft: number;
  isPlaying: boolean;
  needsInteraction: boolean;
  playError: string;
  revealed: boolean;
  finished: boolean;
  players: PlayerView[];
  layout: VersusLayout;
  p2Connected: boolean;
}

export type SyncMessage =
  | { type: 'hello'; sessionId: string }
  | { type: 'state'; sessionId: string; snapshot: GameSnapshot }
  | { type: 'answer'; sessionId: string; optionId: string }
  | { type: 'next'; sessionId: string }
  | { type: 'play-again'; sessionId: string };

@Injectable({ providedIn: 'root' })
export class GameSyncService {
  private channel: BroadcastChannel | null = null;
  private sessionId = '';
  private readonly messages = new Subject<SyncMessage>();

  readonly messages$: Observable<SyncMessage> = this.messages.asObservable();

  connect(sessionId: string): void {
    this.disconnect();
    this.sessionId = sessionId;
    this.channel = new BroadcastChannel(`spotify-trivia-${sessionId}`);
    this.channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      const data = event.data;
      if (!data || data.sessionId !== this.sessionId) {
        return;
      }
      this.messages.next(data);
    };
  }

  send(message: Omit<SyncMessage, 'sessionId'>): void {
    if (!this.channel || !this.sessionId) {
      return;
    }
    this.channel.postMessage({ ...message, sessionId: this.sessionId });
  }

  disconnect(): void {
    this.channel?.close();
    this.channel = null;
    this.sessionId = '';
  }
}
