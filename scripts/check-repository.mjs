import { access, readFile } from 'node:fs/promises'

const requiredFiles = [
  'README.md',
  'README.en.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'ROADMAP.md',
  'SECURITY.md',
  '.github/workflows/ci.yml',
  '.github/workflows/release.yml',
  '.github/dependabot.yml',
  'docs/acceptance-criteria.zh-CN.md',
  'docs/technical-design.zh-CN.md',
  'docs/releasing.md',
  'LICENSE',
]

for (const path of requiredFiles) await access(path)

const acceptance = await readFile('docs/acceptance-criteria.zh-CN.md', 'utf8')
for (const marker of ['SC-01', 'B-01', 'C-01', 'D-01', 'E-01', '一票否决项']) {
  if (!acceptance.includes(marker)) {
    throw new Error(`acceptance document is missing required marker: ${marker}`)
  }
}

const readme = await readFile('README.md', 'utf8')
for (const marker of ['dsh-automation-center@latest', 'dsh-automation-center@0.1.0-alpha.6', '原版兼容模式', 'settings.section']) {
  if (!readme.includes(marker)) throw new Error(`README is missing release marker: ${marker}`)
}

const ci = await readFile('.github/workflows/ci.yml', 'utf8')
for (const marker of ['dsh-v0.1.0-rc.8', 'pnpm check', 'dsh-automation-center.tgz']) {
  if (!ci.includes(marker)) throw new Error(`CI is missing compatibility marker: ${marker}`)
}

const release = await readFile('.github/workflows/release.yml', 'utf8')
for (const marker of ['--provenance', 'sbom-action', 'attest-build-provenance', 'sha256sum']) {
  if (!release.includes(marker)) throw new Error(`release workflow is missing supply-chain marker: ${marker}`)
}
if (!release.includes('npm publish "./${{ steps.pack.outputs.tarball }}"')) {
  throw new Error('release workflow must publish the verified local tarball with an explicit ./ path')
}

console.log(`repository check passed (${requiredFiles.length} required files)`)
