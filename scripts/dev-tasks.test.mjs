import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const readJson = (path) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('NFR-DEV-01: development entry points use the installed pnpm directly', () => {
  const manifest = readJson('../package.json');
  const { tasks } = readJson('../.vscode/tasks.json');
  assert.equal(
    manifest.scripts.dev,
    'pnpm --parallel --filter @thai-please/web --filter @thai-please/api dev',
  );
  for (const workspace of ['web', 'api']) {
    const task = tasks.find(
      (entry) =>
        entry.label === `ThaiPlease: ${workspace === 'web' ? 'Web' : 'API'}`,
    );
    assert.ok(task);
    assert.equal(task.command, 'pnpm');
    assert.deepEqual(task.args, [
      '--filter',
      `@thai-please/${workspace}`,
      'dev',
    ]);
  }
});
