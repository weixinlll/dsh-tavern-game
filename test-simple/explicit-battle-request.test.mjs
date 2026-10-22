import test from 'node:test';
import assert from 'node:assert/strict';
import { explicitBattleRequest } from '../simple/context.mjs';

// 玩家输入不进正文，剧情识别看不到「准备进入战斗」这类指令，
// 所以结算兜底单独问一句：这轮玩家是否明确要求当场开战。
test('当场开战指令被识别', () => {
  for (const input of ['遇到插队的人，准备进入战斗，准备开战', '跟掌书客对峙，开打', '动手吧', '与三名山贼交战']) {
    assert.equal(explicitBattleRequest(input), true, input);
  }
});

test('计划、假设、否定、回忆与名词用法不触发', () => {
  for (const input of ['准备明天开战', '明天再动手吧', '先别动手', '我不想战斗，先找路', '如果开战会怎样', '查看战斗记录', '打探三页书下落', '整理背包，丢掉不用的东西', '上一场战斗已经结束']) {
    assert.equal(explicitBattleRequest(input), false, input);
  }
});

test('战斗刚结束时只有明确动手才开新战', () => {
  assert.equal(explicitBattleRequest('这场战斗我险胜'), true);
  assert.equal(explicitBattleRequest('这场战斗我险胜', { strict: true }), false);
  assert.equal(explicitBattleRequest('开打吧', { strict: true }), true);
});

test('空值与超长输入直接拒绝', () => {
  for (const input of [undefined, null, '', '   ', 123, '开打'.repeat(800)]) {
    assert.equal(explicitBattleRequest(input), false);
  }
});
