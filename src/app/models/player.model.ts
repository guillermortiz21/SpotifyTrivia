import { AnswerResult, RoundRecap } from './quiz-question.model';

export type PlayerId = 1 | 2;
export type PlayerCount = 1 | 2;
export type VersusLayout = 'split' | 'popout';

export interface PointsAward {
  points: number;
  base: number;
  speed: number;
  multiplier: number;
}

export interface PlayerView {
  id: PlayerId;
  name: string;
  selectedId: string | null;
  locked: boolean;
  result: AnswerResult;
  score: number;
  multiplier: number;
  lastAward: PointsAward | null;
  recap: RoundRecap[];
}

export function createPlayerView(id: PlayerId, name: string): PlayerView {
  return {
    id,
    name,
    selectedId: null,
    locked: false,
    result: null,
    score: 0,
    multiplier: 1,
    lastAward: null,
    recap: [],
  };
}

export function resetPlayerRound(player: PlayerView): PlayerView {
  return {
    ...player,
    selectedId: null,
    locked: false,
    result: null,
    lastAward: null,
  };
}
