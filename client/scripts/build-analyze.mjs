import { spawnSync } from 'node:child_process'

const result = spawnSync('npm run build', {
  shell: true,
  stdio: 'inherit',
  env: { ...process.env, BUNDLE_ANALYZE: '1' },
})

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log('Bundle report generated at dist/stats.html')
