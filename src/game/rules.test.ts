import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialProgress, PLAYER_SPAWN, TEMPLE_ZONES, WORSHIP_STEPS } from './data';
import {
  advanceWorshipProgress,
  clampPlayerPosition,
  drawFortuneSlip,
  findNearestZone,
  purchaseOffering,
  purchaseStarterBundle,
  resolveBweiThrow,
  worldToMinimap,
} from './rules';

test('resolveBweiThrow produces Sheng, Xiao, and Yin outcomes accurately', () => {
  const sheng1 = resolveBweiThrow(0.2, 0.8);
  assert.equal(sheng1.outcome, 'sheng');
  assert.equal(sheng1.label, '聖筊');
  assert.notEqual(sheng1.leftFlat, sheng1.rightFlat);

  const sheng2 = resolveBweiThrow(0.7, 0.1);
  assert.equal(sheng2.outcome, 'sheng');

  const xiao = resolveBweiThrow(0.1, 0.2);
  assert.equal(xiao.outcome, 'xiao');
  assert.equal(xiao.label, '笑筊');
  assert.equal(xiao.leftFlat, true);
  assert.equal(xiao.rightFlat, true);

  const yin = resolveBweiThrow(0.8, 0.9);
  assert.equal(yin.outcome, 'yin');
  assert.equal(yin.label, '陰筊');
  assert.equal(yin.leftFlat, false);
  assert.equal(yin.rightFlat, false);
});

test('drawFortuneSlip returns valid fortune across [0, 1) bounds', () => {
  const first = drawFortuneSlip(0);
  const last = drawFortuneSlip(0.9999);
  assert.equal(first.poem.length, 4);
  assert.equal(last.poem.length, 4);
  assert.ok(first.number > 0);
  assert.ok(last.number >= first.number);
});

test('purchaseOffering deducts coins, prevents negative balance, and advances step 1 on free incense', () => {
  const init = createInitialProgress();
  assert.equal(init.coins, 250);
  assert.equal(init.currentStepIndex, 0);

  // Free incense advances step 1 and awards +20 coins
  const res1 = purchaseOffering(init, 'incense');
  assert.equal(res1.success, true);
  assert.equal(res1.nextState.inventory.incense, 1);
  assert.equal(res1.nextState.currentStepIndex, 1);
  assert.equal(res1.nextState.coins, 270);

  // Cannot purchase when broke
  const broke = { ...init, coins: 10 };
  const res2 = purchaseOffering(broke, 'amulet');
  assert.equal(res2.success, false);
  assert.equal(res2.nextState.coins, 10);
});

test('purchaseStarterBundle stocks all offerings and advances step 1', () => {
  const init = createInitialProgress();
  const res = purchaseStarterBundle(init);
  assert.equal(res.success, true);
  assert.equal(res.nextState.inventory.incense, 3);
  assert.equal(res.nextState.inventory.flowers, 1);
  assert.equal(res.nextState.inventory.joss_paper, 1);
  assert.equal(res.nextState.inventory.amulet, 1);
  assert.equal(res.nextState.currentStepIndex, 1);
  assert.equal(res.nextState.coins, 250 - 120 + WORSHIP_STEPS[0].rewardCoins);
});

test('full 11-step traditional worship guide advances cleanly to completion', () => {
  let state = createInitialProgress();
  for (let i = 0; i < WORSHIP_STEPS.length; i++) {
    const step = WORSHIP_STEPS[i];
    const result = advanceWorshipProgress(state, step.requiredAction, step.requiredZone);
    assert.equal(result.stepCompleted, step.stepNumber);
    state = result.nextState;
    if (i < WORSHIP_STEPS.length - 1) {
      assert.equal(result.allCompletedNow, false);
    } else {
      assert.equal(result.allCompletedNow, true);
    }
  }
  assert.equal(state.currentStepIndex, 11);
  assert.equal(state.completedSteps.length, 11);
  assert.ok(state.merit >= 150);
});

test('player spawn and all shrine stand positions are clear of obstacles', () => {
  const clampedSpawn = clampPlayerPosition(PLAYER_SPAWN.x, PLAYER_SPAWN.z);
  assert.ok(Math.hypot(clampedSpawn.x - PLAYER_SPAWN.x, clampedSpawn.z - PLAYER_SPAWN.z) < 0.01);

  for (const zone of Object.values(TEMPLE_ZONES)) {
    const clamped = clampPlayerPosition(zone.standPos.x, zone.standPos.z);
    const drift = Math.hypot(clamped.x - zone.standPos.x, clamped.z - zone.standPos.z);
    assert.ok(drift < 0.05, `Zone ${zone.id} standPos drifted by ${drift}`);
    const detected = findNearestZone(zone.standPos.x, zone.standPos.z);
    assert.equal(detected?.id, zone.id);
  }
});

test('clampPlayerPosition pushes player out of Mazu altar, burner, and world bounds', () => {
  const pushedAltar = clampPlayerPosition(2.0, -8.5);
  assert.ok(pushedAltar.z > -6.3);

  const pushedBurner = clampPlayerPosition(0, -5.0);
  assert.ok(pushedBurner.z > -4.6 || Math.abs(pushedBurner.x) > 0.9);

  const pushedWall = clampPlayerPosition(-50, 50);
  assert.ok(pushedWall.x >= -11.6);
  assert.ok(pushedWall.z <= 15.6);

  const mm = worldToMinimap(0, 0);
  assert.ok(mm.u > 0 && mm.u < 1 && mm.v > 0 && mm.v < 1);
});
