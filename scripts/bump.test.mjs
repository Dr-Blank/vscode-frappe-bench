import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateVersion } from './bump.mjs';

// --- from ODD minor (pre-release version) ---

test('pre-release + patch from odd minor increments patch', () => {
  assert.equal(calculateVersion('0.5.2', 'pre-release', 'patch'), '0.5.3');
});

test('pre-release + patch from 0.5.0', () => {
  assert.equal(calculateVersion('0.5.0', 'pre-release', 'patch'), '0.5.1');
});

test('release + patch from odd minor steps to next even minor', () => {
  assert.equal(calculateVersion('0.5.2', 'release', 'patch'), '0.6.0');
});

test('release + patch from 0.5.0 steps to 0.6.0', () => {
  assert.equal(calculateVersion('0.5.0', 'release', 'patch'), '0.6.0');
});

test('pre-release + minor from odd minor jumps +2', () => {
  assert.equal(calculateVersion('0.5.0', 'pre-release', 'minor'), '0.7.0');
});

test('release + minor from odd minor steps to next even minor', () => {
  assert.equal(calculateVersion('0.5.0', 'release', 'minor'), '0.6.0');
});

// --- from EVEN minor (stable version) ---

test('release + patch from even minor increments patch', () => {
  assert.equal(calculateVersion('0.6.1', 'release', 'patch'), '0.6.2');
});

test('release + patch from 0.6.0', () => {
  assert.equal(calculateVersion('0.6.0', 'release', 'patch'), '0.6.1');
});

test('pre-release + patch from even minor steps to next odd minor', () => {
  assert.equal(calculateVersion('0.6.0', 'pre-release', 'patch'), '0.7.0');
});

test('release + minor from even minor jumps +2', () => {
  assert.equal(calculateVersion('0.6.0', 'release', 'minor'), '0.8.0');
});

test('pre-release + minor from even minor steps to next odd minor', () => {
  assert.equal(calculateVersion('0.6.0', 'pre-release', 'minor'), '0.7.0');
});

// --- major bumps ---

test('release + major resets to even minor 0', () => {
  assert.equal(calculateVersion('0.5.3', 'release', 'major'), '1.0.0');
});

test('pre-release + major resets to odd minor 1', () => {
  assert.equal(calculateVersion('0.6.0', 'pre-release', 'major'), '1.1.0');
});

// --- patch reset on minor step ---

test('release + patch from odd minor always resets patch to 0', () => {
  assert.equal(calculateVersion('0.5.9', 'release', 'patch'), '0.6.0');
});

test('pre-release + patch from even minor always resets patch to 0', () => {
  assert.equal(calculateVersion('0.6.9', 'pre-release', 'patch'), '0.7.0');
});
