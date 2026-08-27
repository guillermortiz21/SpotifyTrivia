import { TrackOption } from './track.model';

export interface QuizQuestion {
  correctTrack: TrackOption;
  options: TrackOption[];
  trackUri: string;
}

export type AnswerResult = 'correct' | 'incorrect' | null;

export interface RoundRecap {
  round: number;
  id: string;
  title: string;
  artist: string;
  correct: boolean;
  points: number;
}
