export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type EyeStyle = 'round' | 'happy' | 'star' | 'heart' | 'calm';
export type EyebrowStyle = 'soft' | 'arched' | 'bold' | 'worried';
export type MouthStyle = 'smile' | 'cat' | 'open' | 'calm';
export type HairStyle = 'twintails' | 'bun' | 'short' | 'long' | 'bob' | 'parted' | 'monk';
export type OutfitStyle = 'white_tang' | 'red_tang' | 'qipao' | 'pilgrim_vest' | 'scholar' | 'hoodie' | 'festival_gold';
export type HeadwearStyle = 'none' | 'mazu_cap' | 'bamboo_hat' | 'flower_crown' | 'cat_ears' | 'wealth_hat';
export type GlassesStyle = 'none' | 'round' | 'shades' | 'heart';

export interface AvatarConfig {
  name: string;
  skinColor: string;
  eyeStyle: EyeStyle;
  eyebrowStyle: EyebrowStyle;
  mouthStyle: MouthStyle;
  blushColor: string;
  hairStyle: HairStyle;
  hairColor: string;
  outfitStyle: OutfitStyle;
  headwear: HeadwearStyle;
  glasses: GlassesStyle;
}

export type ZoneId =
  | 'service'
  | 'tiangong'
  | 'mazu'
  | 'guanyu'
  | 'xuantian'
  | 'yuelao'
  | 'caishen'
  | 'jinlu'
  | 'lanternwall'
  | 'bell';

export type DeityId = 'tiangong' | 'mazu' | 'guanyu' | 'xuantian' | 'yuelao' | 'caishen';

export interface TempleZone {
  id: ZoneId;
  name: string;
  shortName: string;
  subtitle: string;
  isDeity: boolean;
  position: { x: number; z: number };
  standPos: { x: number; z: number };
  facingYaw: number;
  radius: number;
  color: string;
  blessingQuote: string;
  specialActionLabel?: string;
}

export type OfferingId = 'incense' | 'flowers' | 'fruit' | 'cakes' | 'joss_paper' | 'amulet';

export interface OfferingItem {
  id: OfferingId;
  name: string;
  description: string;
  price: number;
  icon: string;
}

export type WorshipActionType =
  | 'claim_offerings'
  | 'place_offerings'
  | 'hold_incense'
  | 'worship_zone'
  | 'divination'
  | 'burn_joss'
  | 'light_lantern'
  | 'ring_bell';

export interface WorshipStep {
  stepNumber: number;
  title: string;
  instruction: string;
  targetZone: ZoneId;
  requiredAction: WorshipActionType;
  requiredZone?: ZoneId;
  rewardCoins: number;
  rewardMerit: number;
}

export type BweiOutcome = 'sheng' | 'xiao' | 'yin';

export interface BweiResult {
  outcome: BweiOutcome;
  leftFlat: boolean;
  rightFlat: boolean;
  label: string;
  summary: string;
  guidance: string;
}

export interface FortuneSlip {
  number: number;
  ganzhi: string;
  rank: string;
  poem: [string, string, string, string];
  meaning: string;
  career: string;
  love: string;
  wealth: string;
  health: string;
}

export type EmoteType = 'idle' | 'bow' | 'kneel' | 'jump' | 'wave' | 'meditate';

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isPlayer?: boolean;
  isSystem?: boolean;
}

export interface LitLantern {
  id: string;
  ownerName: string;
  type: '平安燈' | '姻緣燈' | '財神燈' | '文昌燈';
  wish: string;
  slotIndex: number;
}

export interface ObstacleBox {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PlayerInventory {
  incense: number;
  flowers: number;
  fruit: number;
  cakes: number;
  joss_paper: number;
  amulet: number;
  redThread: boolean;
  fortuneMoney: boolean;
  blessedAmulet: boolean;
}

export interface TempleProgressState {
  currentStepIndex: number; // 0..10 (11 = completed)
  completedSteps: number[];
  coins: number;
  stamina: number;
  merit: number;
  worshipCount: number;
  bweiCount: number;
  fortuneCount: number;
  offeringsPlaced: boolean;
  holdingIncense: boolean;
  litLanterns: LitLantern[];
  inventory: PlayerInventory;
}

export interface NpcPilgrimSeed {
  id: string;
  name: string;
  avatar: AvatarConfig;
  homeZone: ZoneId;
  startX: number;
  startZ: number;
  chatter: string[];
}
