import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveImageTag } from './resolve-production-readiness-image-tag.mjs';

const sha = '536b0ceccc7948b0313a7b53ea1b3264a0fd11d6';

test('uses GITHUB_SHA for a main push without an input', () => {
  assert.equal(resolveImageTag({ eventName: 'push', ref: 'refs/heads/main', sha, input: '' }), sha);
});

test('accepts a matching full SHA for manual dispatch', () => {
  assert.equal(resolveImageTag({ eventName: 'workflow_dispatch', ref: 'refs/heads/main', sha, input: sha }), sha);
});

test('rejects a missing manual input', () => {
  assert.throws(() => resolveImageTag({ eventName: 'workflow_dispatch', ref: 'refs/heads/main', sha, input: '' }), /complete 40-character/);
});

test('rejects a truncated manual input', () => {
  assert.throws(() => resolveImageTag({ eventName: 'workflow_dispatch', ref: 'refs/heads/main', sha, input: sha.slice(0, 7) }), /complete 40-character/);
});

test('rejects a mismatched manual input', () => {
  const otherSha = `a${sha.slice(1)}`;
  assert.throws(() => resolveImageTag({ eventName: 'workflow_dispatch', ref: 'refs/heads/main', sha, input: otherSha }), /must equal GITHUB_SHA/);
});

test('rejects a non-main push', () => {
  assert.throws(() => resolveImageTag({ eventName: 'push', ref: 'refs/heads/feature', sha, input: '' }), /Unsupported production-readiness event/);
});
