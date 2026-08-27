import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { PlayerView } from '../../models/player.model';
import { TrackOption } from '../../models/track.model';

@Component({
  selector: 'app-player-board',
  imports: [DecimalPipe],
  templateUrl: './player-board.component.html',
  styleUrl: './player-board.component.scss',
})
export class PlayerBoardComponent {
  readonly player = input.required<PlayerView>();
  readonly options = input.required<TrackOption[]>();
  readonly revealed = input(false);
  readonly correctTrackId = input<string | null>(null);
  readonly canAnswer = input(true);

  readonly answer = output<TrackOption>();

  isCorrectOption(optionId: string): boolean {
    return this.revealed() && optionId === this.correctTrackId();
  }

  isWrongSelection(optionId: string): boolean {
    const player = this.player();
    return (
      this.revealed() &&
      player.result === 'incorrect' &&
      player.selectedId === optionId
    );
  }

  select(option: TrackOption): void {
    if (!this.canAnswer() || this.player().locked || this.revealed()) {
      return;
    }
    this.answer.emit(option);
  }
}
