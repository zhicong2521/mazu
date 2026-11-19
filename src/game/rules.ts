import {
  FORTUNE_SLIPS,
  OFFERING_CATALOG,
  TEMPLE_OBSTACLES,
  TEMPLE_ZONES,
  WORLD_BOUNDS,
  WORSHIP_STEPS,
} from './data';
import type {
  BweiResult,
  FortuneSlip,
  ObstacleBox,
  OfferingId,
  TempleProgressState,
  TempleZone,
  WorshipActionType,
  ZoneId,
} from './types';

/**
 * Resolves a traditional Taiwanese Moon Block (擲筊) throw from two [0, 1) random values.
 * Each block has a 50% chance of landing flat (陽面) or curved (陰面):
 * - 1 flat + 1 curved => 聖筊 (Sheng Bwei: Divine approval, ~50%)
 * - 2 flat           => 笑筊 (Xiao Bwei: Smiling/unclear, ~25%)
 * - 2 curved         => 陰筊 (Yin Bwei: Not yet/decline, ~25%)
 */
export function resolveBweiThrow(r1: number, r2: number): BweiResult {
  const leftFlat = r1 < 0.5;
  const rightFlat = r2 < 0.5;

  if (leftFlat !== rightFlat) {
    return {
      outcome: 'sheng',
      leftFlat,
      rightFlat,
      label: '聖筊',
      summary: '一平一凸 · 神明應允！',
      guidance: '神明慈悲應允所求，心願順遂、諸事大吉！',
    };
  }

  if (leftFlat && rightFlat) {
    return {
      outcome: 'xiao',
      leftFlat,
      rightFlat,
      label: '笑筊',
      summary: '兩面皆平 · 神明微笑示意',
      guidance: '神明莞爾一笑：心願還可再說清楚些，或答案其實早已在你心中，可靜心再擲一次。',
    };
  }

  return {
    outcome: 'yin',
    leftFlat,
    rightFlat,
    label: '陰筊',
    summary: '兩面皆凸 · 時機尚未成熟',
    guidance: '神明提醒此時機緣未到或尚需多加斟酌，不妨靜心沉澱、調整想法後再行請示。',
  };
}

/**
 * Draws a fortune slip deterministically from a [0, 1) random scalar.
 */
export function drawFortuneSlip(randomValue: number): FortuneSlip {
  const clamped = Math.max(0, Math.min(0.999999, randomValue));
  const index = Math.floor(clamped * FORTUNE_SLIPS.length);
  return FORTUNE_SLIPS[index];
}

/**
 * Purchases or claims an offering from the Service Counter.
 * Returns updated state + status message without ever allowing negative coins.
 */
export function purchaseOffering(
  state: TempleProgressState,
  itemId: OfferingId,
): { nextState: TempleProgressState; success: boolean; message: string } {
  const item = OFFERING_CATALOG.find((o) => o.id === itemId);
  if (!item) {
    return { nextState: state, success: false, message: '找不到此供品項目。' };
  }

  if (state.coins < item.price) {
    return {
      nextState: state,
      success: false,
      message: '香油幣不足！差點「拜到沒錢了」，可點上方「結緣添福」免費領取香油補貼。',
    };
  }

  const nextInventory = {
    ...state.inventory,
    [itemId]: state.inventory[itemId] + 1,
  };

  let nextState: TempleProgressState = {
    ...state,
    coins: state.coins - item.price,
    inventory: nextInventory,
  };

  // Auto-advance step 1 when the player has claimed at least incense or any offering bundle
  if (nextState.currentStepIndex === 0 && nextInventory.incense >= 1) {
    const advanced = advanceWorshipProgress(nextState, 'claim_offerings', 'service');
    nextState = advanced.nextState;
  }

  return {
    nextState,
    success: true,
    message: `已於服務處請得「${item.name}」！`,
  };
}

/**
 * Claims the full starter worship bundle (清香 + 鮮花 + 水果 + 糕餅 + 金紙 + 平安符) in one click.
 */
export function purchaseStarterBundle(
  state: TempleProgressState,
): { nextState: TempleProgressState; success: boolean; message: string } {
  const bundleCost = 120;
  if (state.coins < bundleCost) {
    return {
      nextState: state,
      success: false,
      message: '香油幣不足 120 幣，可單項領取免費清香或先領取結緣香油補貼！',
    };
  }

  const nextState: TempleProgressState = {
    ...state,
    coins: state.coins - bundleCost,
    inventory: {
      ...state.inventory,
      incense: state.inventory.incense + 3,
      flowers: state.inventory.flowers + 1,
      fruit: state.inventory.fruit + 1,
      cakes: state.inventory.cakes + 1,
      joss_paper: state.inventory.joss_paper + 1,
      amulet: state.inventory.amulet + 1,
    },
  };

  const advanced = advanceWorshipProgress(nextState, 'claim_offerings', 'service');
  return {
    nextState: advanced.nextState,
    success: true,
    message: '已一次請妥「完整參拜大禮包」（清香、鮮花、水果、糕餅、金紙、平安符）！',
  };
}

/**
 * Checks whether an action satisfies the current guided worship step (1..11)
 * and advances progress, granting merit and coin rewards.
 */
export function advanceWorshipProgress(
  state: TempleProgressState,
  action: WorshipActionType,
  zoneId?: ZoneId,
): {
  nextState: TempleProgressState;
  stepCompleted: number | null;
  allCompletedNow: boolean;
} {
  if (state.currentStepIndex >= WORSHIP_STEPS.length) {
    return { nextState: state, stepCompleted: null, allCompletedNow: false };
  }

  const currentStep = WORSHIP_STEPS[state.currentStepIndex];
  const actionMatches = currentStep.requiredAction === action;
  const zoneMatches = !currentStep.requiredZone || currentStep.requiredZone === zoneId;

  if (!actionMatches || !zoneMatches) {
    return { nextState: state, stepCompleted: null, allCompletedNow: false };
  }

  const completedSteps = state.completedSteps.includes(currentStep.stepNumber)
    ? state.completedSteps
    : [...state.completedSteps, currentStep.stepNumber];

  const nextIndex = state.currentStepIndex + 1;
  const allCompletedNow = nextIndex >= WORSHIP_STEPS.length;

  const nextState: TempleProgressState = {
    ...state,
    currentStepIndex: nextIndex,
    completedSteps,
    coins: state.coins + currentStep.rewardCoins,
    merit: state.merit + currentStep.rewardMerit,
    stamina: Math.min(100, state.stamina + 5),
  };

  return {
    nextState,
    stepCompleted: currentStep.stepNumber,
    allCompletedNow,
  };
}

/**
 * Resolves 2D circle-vs-AABB collisions against temple pillars, altars, counters, and walls
 * while clamping inside playable world bounds.
 */
export function clampPlayerPosition(
  x: number,
  z: number,
  radius = 0.48,
  obstacles: ObstacleBox[] = TEMPLE_OBSTACLES,
): { x: number; z: number } {
  let px = Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, x));
  let pz = Math.max(WORLD_BOUNDS.minZ, Math.min(WORLD_BOUNDS.maxZ, z));

  for (let pass = 0; pass < 2; pass++) {
    for (const box of obstacles) {
      const closestX = Math.max(box.minX, Math.min(px, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(pz, box.maxZ));
      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          px += (dx / dist) * push;
          pz += (dz / dist) * push;
        } else {
          // Inside box: push out toward nearest edge
          const penLeft = Math.abs(px - box.minX);
          const penRight = Math.abs(box.maxX - px);
          const penTop = Math.abs(pz - box.minZ);
          const penBottom = Math.abs(box.maxZ - pz);
          const minPen = Math.min(penLeft, penRight, penTop, penBottom);
          if (minPen === penLeft) px = box.minX - radius;
          else if (minPen === penRight) px = box.maxX + radius;
          else if (minPen === penTop) pz = box.minZ - radius;
          else pz = box.maxZ + radius;
        }
      }
    }
    px = Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, px));
    pz = Math.max(WORLD_BOUNDS.minZ, Math.min(WORLD_BOUNDS.maxZ, pz));
  }

  return { x: px, z: pz };
}

/**
 * Finds the nearest interactive shrine/station within its interaction radius.
 */
export function findNearestZone(x: number, z: number): TempleZone | null {
  let best: TempleZone | null = null;
  let bestDist = Infinity;

  for (const zone of Object.values(TEMPLE_ZONES)) {
    const dx = x - zone.standPos.x;
    const dz = z - zone.standPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= zone.radius && dist < bestDist) {
      bestDist = dist;
      best = zone;
    }
  }

  return best;
}

/**
 * Computes normalized minimap coordinates (0..1) for any world (x, z).
 */
export function worldToMinimap(x: number, z: number): { u: number; v: number } {
  const u = (x - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX);
  const v = (z - WORLD_BOUNDS.minZ) / (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ);
  return {
    u: Math.max(0.04, Math.min(0.96, u)),
    v: Math.max(0.04, Math.min(0.96, v)),
  };
}
