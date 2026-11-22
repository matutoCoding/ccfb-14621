// 冒烟测试运行器：用 esbuild 把 TS 测试打包成 ESM 后交给 Node 执行
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const require = createRequire(import.meta.url)
const esbuildBin = resolve(dirname(require.resolve('esbuild/package.json')), 'bin/esbuild')
const outDir = resolve(root, 'node_modules/.cache')
const outFile = resolve(outDir, 'smoke.mjs')

mkdirSync(outDir, { recursive: true })
execFileSync(process.execPath, [
  esbuildBin,
  'tests/smoke.ts',
  '--bundle',
  '--platform=node',
  '--format=esm',
  `--alias:@=${resolve(root, 'src')}`,
  `--outfile=${outFile}`
], { cwd: root, stdio: 'inherit' })

execFileSync(process.execPath, [outFile], { cwd: root, stdio: 'inherit' })
