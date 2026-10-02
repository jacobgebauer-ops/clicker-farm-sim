import type Phaser from 'phaser';

/** Everything a mini game needs from the host. */
export interface MiniGameContext {
  game: Phaser.Game;
  /** 1.0 at building level 1, rising slowly with the building's level. */
  difficulty: number;
  reduceMotion: boolean;
  /** Called once when the round ends. `quit` is true when the player left early. */
  finish(score: number, stars: number, quit?: boolean): void;
  /** For games that count Luna moments (Weed Pull). */
  lunaMoment(): void;
}

/** Shared interface: each mini game is a self-contained folder exporting one of these. */
export interface MiniGame {
  id: string;
  title: string;
  /** Phaser scene key the game runs in. */
  sceneKey: string;
  /** The scene class; registered with the game on boot. */
  scene: typeof Phaser.Scene;
  start(ctx: MiniGameContext): void;
  /** Map a final score to 0 to 3 stars. */
  onResult(score: number): number;
}
