#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const isEven = n => n % 2 === 0;

export function calculateVersion(currentVersion, type, bump) {
  let [major, minor, patch] = currentVersion.split('.').map(Number);
  const isRelease = type === 'release';

  // release → even minor, pre-release → odd minor
  if (bump === 'major') {
    major++;
    minor = isRelease ? 0 : 1;
    patch = 0;
  } else if (bump === 'minor') {
    patch = 0;
    if (isRelease) {
      minor = isEven(minor) ? minor + 2 : minor + 1;
    } else {
      minor = isEven(minor) ? minor + 1 : minor + 2;
    }
  } else if (bump === 'patch') {
    if (isRelease && isEven(minor)) {
      patch++;
    } else if (!isRelease && !isEven(minor)) {
      patch++;
    } else if (isRelease && !isEven(minor)) {
      // on odd (pre-release) minor → step to next even minor
      minor++;
      patch = 0;
    } else {
      // on even (stable) minor → step to next odd minor
      minor++;
      patch = 0;
    }
  }

  return `${major}.${minor}.${patch}`;
}

// only run CLI logic when invoked directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);
  const type = args.find(a => a.startsWith('--type='))?.split('=')[1];
  const bump = args.find(a => a.startsWith('--bump='))?.split('=')[1];

  if (!type || !bump || !['release', 'pre-release'].includes(type) || !['major', 'minor', 'patch'].includes(bump)) {
    console.error('Usage: node scripts/bump.mjs --type=release|pre-release --bump=major|minor|patch');
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const newVersion = calculateVersion(pkg.version, type, bump);
  console.log(`${pkg.version} → ${newVersion} (${type})`);

  pkg.version = newVersion;
  writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

  execSync('git add package.json', { stdio: 'inherit' });
  execSync(`git commit -m "chore(release): bump v${newVersion}"`, { stdio: 'inherit' });
  execSync(`git tag v${newVersion}`, { stdio: 'inherit' });
  execSync('git push --follow-tags', { stdio: 'inherit' });
  console.log(`\nTagged and pushed v${newVersion}`);
}
