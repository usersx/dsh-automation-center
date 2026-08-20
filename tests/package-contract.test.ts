import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

interface PackageManifest {
  name?: string
  exports?: Record<string, { default?: string } | string>
  files?: string[]
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
  dependencies?: Record<string, string>
  scripts?: Record<string, string>
  dsh?: {
    bundle?: { patch?: string }
    client?: { platform?: string; inject?: string[] }
  }
}

const root = new URL('../', import.meta.url)

test('package keeps the installable DSH bundle and Web client contract', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('package.json', root), 'utf8'),
  ) as PackageManifest

  assert.equal(manifest.name, 'dsh-automation-center')
  assert.equal(manifest.dsh?.bundle?.patch, './cordis.patch.yml')
  assert.equal(manifest.dsh?.client?.platform, 'web')
  assert.deepEqual(manifest.dsh?.client?.inject, [
    '@deepseek-ai/dsh-client-connection',
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-ui-layout',
    '@deepseek-ai/dsh-client-ui-sidebar',
    '@deepseek-ai/dsh-client-ui-conversation',
  ])
  assert.deepEqual(manifest.exports?.['./client'], {
    types: './lib/types/client/index.d.ts',
    default: './lib/client.js',
  })
  assert.ok(manifest.files?.includes('lib/*.js'))
  assert.ok(manifest.files?.includes('lib/types'))
  assert.ok(manifest.files?.includes('cordis.patch.yml'))
  assert.deepEqual(manifest.dependencies, undefined)
  assert.equal(manifest.scripts?.prepare, undefined)
  assert.equal(manifest.peerDependencies?.react, '^18.2.0')
  assert.deepEqual(manifest.peerDependenciesMeta?.react, { optional: true })

  const patch = await readFile(new URL('cordis.patch.yml', root), 'utf8')
  assert.match(patch, /^\s*- insert:\s*$/m)
  assert.match(patch, /^\s*- id: dsh-automation-center\s*$/m)
  assert.match(patch, /^\s*name: ['"]dsh-automation-center['"]\s*$/m)
  assert.match(patch, /^\s*archiveRunSessions: false\s*$/m)

  await Promise.all([
    access(new URL('lib/index.js', root)),
    access(new URL('lib/client.js', root)),
    access(new URL('lib/types/index.d.ts', root)),
    access(new URL('lib/types/client/index.d.ts', root)),
  ])
  const clientBundle = await readFile(new URL('lib/client.js', root), 'utf8')
  assert.match(clientBundle, /window\.__ModuleLoader__\.load\(/)
  assert.match(clientBundle, /dsh-automation-center-client/)
  assert.match(clientBundle, /sessionArchived/)
  assert.match(clientBundle, /conversation\.view/)
  assert.match(clientBundle, /sidebar\.primary\.action/)
  const hostBundle = await readFile(new URL('lib/index.js', root), 'utf8')
  assert.match(hostBundle, /archiveRunSessions: .*\.boolean\(\)\.default\(false\)/)
  assert.match(hostBundle, /node_modules\/\.pnpm\/luxon@/)
  assert.match(hostBundle, /node_modules\/\.pnpm\/zod@/)
})
