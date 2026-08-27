import { DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GameService } from '../../services/game.service';
import { GameSnapshot, GameSyncService } from '../../services/game-sync.service';
import { SpotifyPlayerService } from '../../services/spotify-player.service';
import {
  createPlayerView,
  PlayerCount,
  PlayerId,
  PlayerView,
  resetPlayerRound,
  VersusLayout,
} from '../../models/player.model';
import { TrackOption } from '../../models/track.model';

const CLIP_DURATION_MS = 30_000;
const BASE_POINTS = 100;
const SPEED_MAX_POINTS = 200;
const TOTAL_ROUNDS = 10;

@Component({
  selector: 'app-game',
  imports: [RouterLink, DecimalPipe, PlayerBoardComponent],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
})
export class GameComponent implements OnInit, OnDestroy {
  private readonly game = inject(GameService);
  private readonly player = inject(SpotifyPlayerService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly sync = inject(GameSyncService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isGuest =
    this.route.snapshot.queryParamMap.get('seat') === '2';
  readonly totalRounds = TOTAL_ROUNDS;

  question = signal<QuizQuestion | null>(null);
  isPlaying = signal(false);
  needsInteraction = signal(false);
  playError = signal('');
  timeLeft = signal(30);
  round = signal(1);
  finished = signal(false);
  revealed = signal(false);
  playerCount = signal<PlayerCount>(1);
  players = signal<PlayerView[]>([
    createPlayerView(1, 'Player 1'),
    createPlayerView(2, 'Player 2'),
  ]);
  layout = signal<VersusLayout>('split');
  p2Connected = signal(false);
  initError = signal('');
  popoutError = signal('');

  readonly isVersus = computed(() => this.playerCount() === 2);
  readonly activePlayers = computed(() =>
    this.players().slice(0, this.playerCount())
  );
  readonly visiblePlayers = computed(() => {
    const active = this.activePlayers();
    if (!this.isVersus()) {
      return active;
    }
    if (this.isGuest) {
      return active.filter((item) => item.id === 2);
    }
    if (this.layout() === 'popout') {
      return active.filter((item) => item.id === 1);
    }
    return active;
  });
  readonly showSplit = computed(
    () => this.isVersus() && !this.isGuest && this.layout() === 'split'
  );
  readonly correctCount = computed(
    () => this.players()[0].recap.filter((entry) => entry.correct).length
  );
  readonly recapRows = computed(() => {
    const [p1, p2] = this.players();
    return p1.recap.map((entry, index) => ({
      round: entry.round,
      title: entry.title,
      artist: entry.artist,
      p1: entry,
      p2: p2.recap[index],
    }));
  });
  readonly winnerText = computed(() => {
    const [p1, p2] = this.players();
    if (p1.score === p2.score) {
      return "It's a tie!";
    }
    return p1.score > p2.score ? `${p1.name} wins!` : `${p2.name} wins!`;
  });

  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private clipEndTimer: ReturnType<typeof setTimeout> | null = null;
  private helloTimer: ReturnType<typeof setInterval> | null = null;
  private roundStartedAt: number | null = null;

  ngOnInit(): void {
    if (this.isGuest) {
      if (!this.game.loadSession()) {
        this.initError.set(
          "Couldn't find the 2-player session. Open this screen from Player 1."
        );
        return;
      }
    } else if (this.game.getPlayableTrackCount() < 4) {
      void this.router.navigate(['/']);
      return;
    }

    const names = this.game.getPlayerNames();
    this.playerCount.set(this.game.getPlayerCount());
    this.players.set([
      createPlayerView(1, names[0]),
      createPlayerView(2, names[1]),
    ]);

    if (this.isVersus()) {
      if (!this.isGuest) {
        this.game.persistSession();
      }
      this.sync.connect(this.game.getSessionId());
      this.sync.messages$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((message) => this.onSyncMessage(message));
    }

    void this.initializeAndStart();
  }

  ngOnDestroy(): void {
    this.stopClip();
    this.clearHello();
    this.sync.disconnect();
    if (!this.isGuest) {
      this.player.disconnect();
    }
  }

  async initializeAndStart(): Promise<void> {
    if (this.isGuest) {
      this.sync.send({ type: 'hello' });
      this.helloTimer = setInterval(() => {
        this.sync.send({ type: 'hello' });
      }, 600);
      return;
    }

    try {
      await this.player.initialize();
      this.loadQuestion(false);
    } catch (err) {
      this.initError.set(
        err instanceof Error ? err.message : 'Could not start Spotify playback.'
      );
    }
  }

  loadQuestion(autoPlay: boolean): void {
    if (this.isGuest) {
      return;
    }

    this.playError.set('');
    this.timeLeft.set(30);
    this.roundStartedAt = null;
    this.revealed.set(false);
    this.players.update((list) => list.map((item) => resetPlayerRound(item)));

    try {
      const usedIds = this.players()[0].recap.map((entry) => entry.id);
      this.question.set(this.game.generateQuestion(usedIds));
      if (autoPlay) {
        void this.startClip();
      } else {
        this.needsInteraction.set(true);
      }
      this.broadcast();
    } catch {
      void this.router.navigate(['/']);
    }
  }

  playClip(): void {
    if (this.isGuest) {
      return;
    }
    this.playError.set('');
    void this.player.activateAudio().then(() => this.startClip());
  }

  replayClip(): void {
    if (this.revealed() || this.isGuest) {
      return;
    }
    void this.player.activateAudio().then(() => this.startClip());
  }

  onPlayerAnswer(playerId: PlayerId, option: TrackOption): void {
    if (this.isGuest) {
      this.sync.send({ type: 'answer', optionId: option.id });
      return;
    }
    this.lockAnswer(playerId, option);
  }

  canBoardAnswer(player: PlayerView): boolean {
    if (this.revealed() || player.locked || this.finished()) {
      return false;
    }
    if (this.isGuest) {
      return player.id === 2;
    }
    if (this.isVersus() && this.layout() === 'popout') {
      return player.id === 1;
    }
    return true;
  }

  nextRound(): void {
    if (this.isGuest) {
      this.sync.send({ type: 'next' });
      return;
    }
    if (!this.revealed()) {
      return;
    }

    if (this.round() >= TOTAL_ROUNDS) {
      this.finished.set(true);
      this.stopClip();
      this.broadcast();
      return;
    }

    this.round.update((r) => r + 1);
    this.loadQuestion(true);
  }

  playAgain(): void {
    if (this.isGuest) {
      this.sync.send({ type: 'play-again' });
      return;
    }

    const names = this.game.getPlayerNames();
    this.finished.set(false);
    this.revealed.set(false);
    this.round.set(1);
    this.players.set([
      createPlayerView(1, names[0]),
      createPlayerView(2, names[1]),
    ]);
    this.loadQuestion(false);
  }

  openPlayerTwoScreen(): void {
    this.popoutError.set('');
    this.game.persistSession();
    this.layout.set('popout');
    const opened = window.open(
      `${window.location.origin}/game?seat=2`,
      'spotify-trivia-p2',
      'width=560,height=900'
    );
    if (!opened) {
      this.layout.set('split');
      this.popoutError.set(
        'Allow pop-ups to open Player 2 in another window, or keep playing side by side.'
      );
    }
    this.broadcast();
  }

  showSplitScreen(): void {
    this.layout.set('split');
    this.broadcast();
  }

  private onSyncMessage(message: GameSnapshot extends never ? never : import('../../services/game-sync.service').SyncMessage): void {
    if (this.isGuest) {
      if (message.type === 'state') {
        this.applySnapshot(message.snapshot);
        this.clearHello();
      }
      return;
    }

    if (message.type === 'hello') {
      this.p2Connected.set(true);
      this.broadcast();
      return;
    }
    if (message.type === 'answer') {
      const option = this.question()?.options.find(
        (item) => item.id === message.optionId
      );
      if (option) {
        this.lockAnswer(2, option);
      }
      return;
    }
    if (message.type === 'next') {
      this.nextRound();
      return;
    }
    if (message.type === 'play-again') {
      this.playAgain();
    }
  }

  private lockAnswer(playerId: PlayerId, option: TrackOption): void {
    const current = this.players().find((item) => item.id === playerId);
    if (!current || current.locked || this.revealed()) {
      return;
    }

    const q = this.question();
    const correct = option.id === q?.correctTrack.id;
    let points = 0;
    let lastAward = current.lastAward;
    let multiplier = current.multiplier;

    if (correct) {
      const speed = this.computeSpeedBonus();
      points = (BASE_POINTS + speed) * current.multiplier;
      lastAward = {
        points,
        base: BASE_POINTS,
        speed,
        multiplier: current.multiplier,
      };
      multiplier = current.multiplier + 1;
    } else {
      lastAward = null;
      multiplier = 1;
    }

    const recapEntry = q
      ? {
          round: this.round(),
          id: q.correctTrack.id,
          title: q.correctTrack.title,
          artist: q.correctTrack.artist,
          correct,
          points,
        }
      : null;

    this.players.update((list) =>
      list.map((item) =>
        item.id !== playerId
          ? item
          : {
              ...item,
              selectedId: option.id,
              locked: true,
              result: correct ? 'correct' : 'incorrect',
              score: item.score + points,
              multiplier,
              lastAward,
              recap: recapEntry ? [...item.recap, recapEntry] : item.recap,
            }
      )
    );

    const allLocked = this.activePlayers().every((item) => item.locked);
    if (allLocked) {
      this.revealed.set(true);
      this.stopClip();
    }

    this.broadcast();
  }

  private applySnapshot(snapshot: GameSnapshot): void {
    this.round.set(snapshot.round);
    this.question.set(snapshot.question);
    this.timeLeft.set(snapshot.timeLeft);
    this.isPlaying.set(snapshot.isPlaying);
    this.needsInteraction.set(snapshot.needsInteraction);
    this.playError.set(snapshot.playError);
    this.revealed.set(snapshot.revealed);
    this.finished.set(snapshot.finished);
    this.players.set(snapshot.players);
    this.layout.set(snapshot.layout);
    this.p2Connected.set(snapshot.p2Connected);
    this.playerCount.set(2);
  }

  private toSnapshot(): GameSnapshot {
    return {
      round: this.round(),
      question: this.question(),
      timeLeft: this.timeLeft(),
      isPlaying: this.isPlaying(),
      needsInteraction: this.needsInteraction(),
      playError: this.playError(),
      revealed: this.revealed(),
      finished: this.finished(),
      players: this.players(),
      layout: this.layout(),
      p2Connected: this.p2Connected(),
    };
  }

  private broadcast(): void {
    if (!this.isVersus() || this.isGuest) {
      return;
    }
    this.sync.send({ type: 'state', snapshot: this.toSnapshot() });
  }

  private async startClip(): Promise<void> {
    this.stopClipTimers();
    this.needsInteraction.set(false);
    this.playError.set('');

    const q = this.question();
    if (!q) {
      return;
    }

    this.isPlaying.set(true);
    this.timeLeft.set(30);
    if (this.roundStartedAt === null) {
      this.roundStartedAt = Date.now();
    }

    this.countdownInterval = setInterval(() => {
      this.timeLeft.update((t) => Math.max(0, t - 1));
      this.broadcast();
    }, 1000);

    this.clipEndTimer = setTimeout(() => {
      this.isPlaying.set(false);
      this.stopClipTimers();
      this.broadcast();
    }, CLIP_DURATION_MS);

    this.broadcast();

    try {
      await this.player.playTrack(q.trackUri, CLIP_DURATION_MS);
    } catch (err) {
      this.isPlaying.set(false);
      this.stopClipTimers();
      this.needsInteraction.set(true);
      this.playError.set(
        err instanceof Error
          ? err.message
          : 'Could not play this track. Click Play clip to try again.'
      );
      this.broadcast();
    }
  }

  private stopClip(): void {
    this.stopClipTimers();
    if (!this.isGuest) {
      void this.player.pause();
    }
    this.isPlaying.set(false);
  }

  private stopClipTimers(): void {
    if (this.clipEndTimer) {
      clearTimeout(this.clipEndTimer);
      this.clipEndTimer = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private computeSpeedBonus(): number {
    if (this.roundStartedAt === null) {
      return 0;
    }

    const elapsedMs = Date.now() - this.roundStartedAt;
    const remainingRatio = Math.max(0, 1 - elapsedMs / CLIP_DURATION_MS);
    return Math.round(SPEED_MAX_POINTS * remainingRatio);
  }

  private clearHello(): void {
    if (this.helloTimer) {
      clearInterval(this.helloTimer);
      this.helloTimer = null;
    }
  }
}

import { PlayerBoardComponent } from '../player-board/player-board.component';
import { QuizQuestion } from '../../models/quiz-question.model';
import { SyncMessage } from '../../services/game-sync.service';
