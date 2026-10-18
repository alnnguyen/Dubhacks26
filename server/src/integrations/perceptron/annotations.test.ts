import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBoxes, parseMoments } from './annotations.js';

test('clip annotations reject invalid/foreign ranges, cap duration and deduplicate overlaps', () => {
  const moments = parseMoments(`
    <clip mention="outside" t="50 seconds 60 seconds" />
    <clip mention="wrong asset" asset_idx="1" t="0 seconds 1 seconds" />
    <clip mention="bad" t="NaN" />
    <clip mention="reverse" t="4 seconds 2 seconds" />
    <clip mention="Swing &amp; recover" t="1 seconds 9 seconds" />
    <clip mention="duplicate" t="2 seconds 4 seconds" />
    <clip mention='Duck' t='8s' />
    <clip mention="Late action" t="11 seconds 14 seconds" />
    <clip mention="fourth" t="15 seconds 16 seconds" />`, 12);
  assert.deepEqual(moments, [
    { start: 1, end: 6, caption: 'Swing & recover' },
    { start: 8, end: 10, caption: 'Duck' },
    { start: 11, end: 12, caption: 'Late action' },
  ]);
  assert.deepEqual(parseMoments('A big swing occurred, trust me.', 10), []);
});

test('timestamped boxes are normalized; missing times, foreign tracks and invalid geometry are discarded', () => {
  const boxes = parseBoxes(`<track mention="player">
    <point_box t="2 seconds"> (100,200) (700,900) </point_box>
    <point_box t="1s"> (200,300) (600,800) </point_box>
    <point_box> (100,100) (200,200) </point_box>
    <point_box t="3s"> (900,100) (200,200) </point_box>
    <point_box t="4s"> (0,0) (1001,1000) </point_box>
    <point_box t="20s"> (0,0) (1000,1000) </point_box>
    </track><track asset_idx="2"><point_box t="0s"> (0,0) (1000,1000) </point_box></track>`, 5);
  assert.deepEqual(boxes, [
    { at: 1, x1: .2, y1: .3, x2: .6, y2: .8 },
    { at: 2, x1: .1, y1: .2, x2: .7, y2: .9 },
  ]);
});
