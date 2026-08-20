import { access, readFile } from 'node:fs/promises'

const requiredFiles = [
  'README.md',
  'README.en.md',
  'ROADMAP.md',
  'docs/acceptance-criteria.zh-CN.md',
  'docs/technical-design.zh-CN.md',
  'LICENSE',
]

for (const path of requiredFiles) await access(path)

const acceptance = await readFile('docs/acceptance-criteria.zh-CN.md', 'utf8')
for (const marker of ['B-01', 'C-01', 'D-01', 'E-01', '一票否决项']) {
  if (!acceptance.includes(marker)) {
    throw new Error(`acceptance document is missing required marker: ${marker}`)
  }
}

console.log(`repository check passed (${requiredFiles.length} required files)`)
