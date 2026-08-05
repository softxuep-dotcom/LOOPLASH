export interface Vec2 {
  x: number;
  y: number;
}

export type GamePhase =
  | 'ready'
  | 'playing'
  | 'pattern-choice'
  | 'rule-choice'
  | 'paused'
  | 'gameover'
  | 'victory';

export type BiomeId = 'meadow' | 'reef';
export type ObjectiveId = 'harvest' | 'rescue' | 'knotbreak';
export type NeedleId = 'dawn' | 'twin' | 'moon';
export type PatternFamily = 'ember' | 'tide' | 'seed' | 'prism';
export type Essence = PatternFamily | 'wild';

export type EnemyId =
  | 'puff'
  | 'needler'
  | 'shellbud'
  | 'bomb-bloom'
  | 'skipper'
  | 'splitter'
  | 'mirrorling'
  | 'bubble-ray';

export type EliteId = 'knot-knight' | 'storm-spool' | 'twin-maw';

export interface NeedleDefinition {
  id: NeedleId;
  nameKey: string;
  descriptionKey: string;
  glyph: string;
  color: number;
  /** Maximum thread length as a fraction of the playfield's shorter side. */
  maxLength: number;
  needleSpeed: number;
  anchorPull: number;
  tensionRate: number;
  captureTolerance: number;
  projectileCapacity: number;
  baseChordRepeats: number;
}

export interface PatternDefinition {
  id: string;
  nameKey: string;
  descriptionKey: string;
  family: PatternFamily;
  glyph: string;
  color: number;
  modifiers: Partial<PatternModifiers>;
}

export interface PatternModifiers {
  chordRepeats: number;
  chordDamage: number;
  captureTolerance: number;
  tensionRate: number;
  anchorPull: number;
  projectileCapacity: number;
  reflectedPower: number;
  tightShield: number;
  healEvery: number;
  flowGrace: number;
  snapBlast: number;
  scoreMultiplier: number;
}

export interface SeamDefinition {
  id: string;
  nameKey: string;
  familyA: PatternFamily;
  familyB: PatternFamily;
  modifiers: Partial<PatternModifiers>;
}

export interface WorldRuleDefinition {
  id: string;
  nameKey: string;
  descriptionKey: string;
  glyph: string;
  modifiers: {
    enemySpeed?: number;
    spawnCount?: number;
    projectileSpeed?: number;
    armorDelta?: number;
    scoreMultiplier?: number;
    tensionRate?: number;
    echoChord?: boolean;
    wildEveryThird?: boolean;
  };
}

export interface EnemyDefinition {
  id: EnemyId;
  nameKey: string;
  biome: BiomeId;
  color: number;
  accent: number;
  radius: number;
  speed: number;
  score: number;
  essence: Essence;
  health: number;
  armor: number;
  behavior: 'chase' | 'shoot' | 'armored' | 'bomb' | 'skip' | 'split' | 'mirror' | 'orbit-shoot';
}

export interface EnemyState {
  uid: number;
  type: EnemyId | EliteId | 'tanglejaw';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: number;
  accent: number;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  speed: number;
  score: number;
  essence: Essence;
  behavior: EnemyDefinition['behavior'] | 'elite-knot' | 'elite-storm' | 'elite-twin' | 'boss';
  cooldown: number;
  age: number;
  phase: number;
  linkedUid?: number;
  dead?: boolean;
  flash?: number;
}

export interface ProjectileState {
  uid: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: number;
  life: number;
  captured?: boolean;
}

export interface MoteState {
  uid: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface EffectState {
  uid: number;
  type: 'snap' | 'capture' | 'hit' | 'shield' | 'chord' | 'burst' | 'heal' | 'spawn';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  radius: number;
  color: number;
  life: number;
  maxLife: number;
}

export interface ObjectiveState {
  id: ObjectiveId;
  current: number;
  target: number;
}

export interface PlayerState {
  anchor: Vec2;
  needle: Vec2;
  /**
   * Gap between the needle and the pointer captured at touch-down, decayed to
   * zero over the first fraction of a second. Lets the gesture begin without
   * the needle teleporting, then settle into direct one-to-one control.
   */
  grabOffset: Vec2;
  path: Vec2[];
  drawing: boolean;
  tension: number;
  hearts: number;
  maxHearts: number;
  invulnerable: number;
  shield: number;
  flow: number;
  flowGrace: number;
  score: number;
  combo: number;
  capturedShots: number;
  needleId: NeedleId;
  patternSlots: Array<string | null>;
  essences: Essence[];
  totalCaptures: number;
  lastSnapWasSweet: boolean;
}

export interface GameState {
  phase: GamePhase;
  previousPhase: GamePhase;
  width: number;
  height: number;
  runSeed: number;
  elapsed: number;
  stage: number;
  biome: BiomeId;
  objective: ObjectiveState;
  player: PlayerState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  motes: MoteState[];
  effects: EffectState[];
  worldRules: string[];
  activeSeams: string[];
  patternChoices: string[];
  ruleChoices: string[];
  tutorialStep: number;
  bannerKey: string;
  bannerTimer: number;
  spawnTimer: number;
  spawnedInStage: number;
  stageQuota: number;
  eliteSpawned: boolean;
  stageCompleteTimer: number;
  awaitingRuleAfterPattern: boolean;
  bossStarted: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

export interface InputFrame {
  deployPressed: boolean;
  deployHeld: boolean;
  deployReleased: boolean;
  /** Relative steering vector. Keyboard control only; pointers use `pointer`. */
  steer: Vec2;
  /**
   * Absolute pointer position in world space while a pointer drives the
   * gesture, otherwise null. Absolute control keeps the needle under the
   * finger; a purely relative offset displaced it by (anchor - touch point)
   * for the whole gesture.
   */
  pointer: Vec2 | null;
  pausePressed: boolean;
}

export interface RuntimeSnapshot {
  phase: GamePhase;
  stage: number;
  biome: BiomeId;
  objective: ObjectiveState;
  score: number;
  hearts: number;
  maxHearts: number;
  shield: number;
  flow: number;
  tension: number;
  capturedShots: number;
  projectileCapacity: number;
  needleId: NeedleId;
  patternSlots: Array<string | null>;
  essences: Essence[];
  worldRules: string[];
  activeSeams: string[];
  patternChoices: string[];
  ruleChoices: string[];
  bannerKey: string;
  tutorialStep: number;
  reducedMotion: boolean;
  highContrast: boolean;
}
