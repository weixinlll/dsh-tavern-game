import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const client = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const source = client;
const block = source.split('// SKELETON_BEGIN')[1].split('// SKELETON_END')[0];
function load(environment = {}) {
  const context = vm.createContext(environment);
  vm.runInContext(block + '\nglobalThis.rigHelpers = { parseLayeredRig, makeRigPose, RigFigure, layeredRigTemplate };', context);
  return context.rigHelpers;
}
const { parseLayeredRig, makeRigPose, layeredRigTemplate } = load();
const close = (actual, expected) => { assert.equal(actual.length, expected.length); actual.forEach((value, index) => assert(Math.abs(value - expected[index]) < 1e-9, `${value} != ${expected[index]}`)); };
const simple = () => ({ kind: 'layered-rig', schemaVersion: 1,
  bones: [{ id: 'body', x: 0.5, y: 0.2, length: 0.3, angle: 90 }, { id: 'arm', parent: 'body', length: 0.2, angle: -90 }, { id: 'hand', parent: 'arm', length: 0.1 }],
  parts: [{ bone: 'body', width: 0.2, height: 0.3 }], clips: { idle: { duration: 1, loop: true, keyframes: [{ time: 0, angles: {} }] } } });

test('layered rig composes actual hierarchical transforms and is independent of bone ordering', () => {
  const rig = parseLayeredRig(simple()), pose = makeRigPose(rig);
  close(pose.body, [0, 1, -1, 0, 0.5, 0.2]);
  close(pose.arm, [1, 0, 0, 1, 0.2, 0.2]);
  close(pose.hand, [1, 0, 0, 1, 0.2, 0.4]);
  const reordered = simple(); reordered.bones.reverse();
  close(makeRigPose(parseLayeredRig(reordered)).hand, pose.hand);
  const reserved = simple(); reserved.bones[0].id = 'constructor'; reserved.bones[1].parent = 'constructor'; reserved.parts[0].bone = 'constructor';
  close(makeRigPose(parseLayeredRig(reserved)).constructor, pose.body);
});

test('finite clip interpolation loops or clamps and unknown modes fall back to idle', () => {
  const input = simple(); input.bones[0].angle = 0;
  input.clips.idle.keyframes = [{ time: 0, angles: { body: 0 } }, { time: 1, angles: { body: 90 } }];
  input.clips.attack = { duration: 1, loop: false, keyframes: input.clips.idle.keyframes };
  const rig = parseLayeredRig(input), cosine = Math.SQRT1_2;
  close(makeRigPose(rig, 'idle', 0.5).body, [cosine, cosine, -cosine, cosine, 0.5, 0.2]);
  close(makeRigPose(rig, 'idle', 1.5).body, makeRigPose(rig, 'idle', 0.5).body);
  close(makeRigPose(rig, 'attack', 100).body, [0, 1, -1, 0, 0.5, 0.2]);
  close(makeRigPose(rig, 'missing', NaN).body, [1, 0, 0, 1, 0.5, 0.2]);
  close(makeRigPose(rig, 'constructor', 0).body, [1, 0, 0, 1, 0.5, 0.2]);
  for (const matrix of Object.values(makeRigPose(rig, 'idle', Infinity))) assert(matrix.every(Number.isFinite));
});

test('import validation rejects parent cycles, excessive complexity, bad angles and unsafe image URLs', () => {
  for (const mutate of [
    value => { value.bones[0].parent = 'hand'; },
    value => { value.bones[0].parent = 'missing'; },
    value => { value.bones[0].x = -0.1; },
    value => { value.bones[0].angle = Infinity; },
    value => { value.bones[1].id = 'body'; },
    value => { value.bones = Array.from({ length: 25 }, (_, index) => ({ id: `bone${index}` })); },
    value => { value.parts = Array.from({ length: 33 }, () => ({ bone: 'body' })); },
    value => { value.parts[0].crop = { x: 0.8, width: 0.5, height: 1 }; },
    value => { value.parts[0].width = 0; },
    value => { value.clips.idle.keyframes = Array.from({ length: 17 }, (_, time) => ({ time, angles: {} })); },
    value => { value.clips.idle.keyframes = [{ time: 0.5, angles: {} }, { time: 0.1, angles: {} }]; },
    value => { value.clips.idle.keyframes[0].angles.missing = 45; },
    value => { value.clips.idle.duration = 0; },
    value => { value.clips.script = value.clips.idle; },
  ]) {
    const input = simple(); mutate(input); assert.throws(() => parseLayeredRig(input));
  }
  for (const src of ['javascript:alert(1)', 'https://example.test/image.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'file:///C:/image.png']) {
    const input = simple(); input.parts[0].src = src; assert.throws(() => parseLayeredRig(input), /图片/);
  }
  for (const src of ['data:image/png;base64,AA==', 'data:image/jpeg;base64,AA==', 'data:image/webp;base64,AA==', 'blob:https://local.test/rig']) {
    const input = simple(); input.parts[0].src = src; assert.equal(parseLayeredRig(input).parts[0].src, src);
  }
});

test('working template round-trips with separate crop layers and animated child joints', () => {
  const rig = parseLayeredRig(JSON.stringify(layeredRigTemplate()));
  assert.equal(rig.bones.length, 3); assert.equal(rig.parts.length, 3);
  assert.equal(rig.parts[0].crop.x, 0); assert.equal(rig.parts[2].crop.x, 2 / 3);
  const idle = makeRigPose(rig, 'idle', 0), attack = makeRigPose(rig, 'attack', 0.2);
  assert.notDeepEqual(Array.from(idle.upper), Array.from(attack.upper));
  assert.notDeepEqual(Array.from(idle.forearm), Array.from(attack.forearm));
});

test('SVG renderer clips atlas layers, updates real bone transforms and cancels animation on cleanup', () => {
  const hooks = [], frames = new Map(); let next = 0, cancelled;
  const helpers = load({
    h: (type, props, ...children) => ({ type, props: props || {}, children }),
    useRef: value => ({ current: value }), useEffect: fn => hooks.push(fn),
    requestAnimationFrame: fn => { frames.set(++next, fn); return next; },
    cancelAnimationFrame: id => { cancelled = id; frames.delete(id); },
  });
  const rig = helpers.parseLayeredRig(helpers.layeredRigTemplate());
  const tree = helpers.RigFigure({ rig, texture: 'data:image/png;base64,AA==', mode: 'attack' });
  assert.equal(tree.type, 'svg');
  const groups = tree.children[0], painted = [];
  for (const [index, group] of groups.entries()) {
    assert.equal(group.children[0].children[0].type, 'clipPath');
    assert.match(group.children[1].props.clipPath, /^url\(#stg-rig-/);
    group.props.ref({ setAttribute: (name, value) => { painted[index] = value; } });
  }
  const cleanup = hooks[0](); frames.get(1)(1000); const initial = [...painted]; frames.get(2)(1200);
  assert.notEqual(painted[1], initial[1]); assert.match(painted[1], /^matrix\(/);
  cleanup(); assert.equal(cancelled, 3);
  const unsafe = helpers.RigFigure({ rig, texture: 'javascript:alert(1)' });
  assert(unsafe.children[0].every(group => group === null));
});
