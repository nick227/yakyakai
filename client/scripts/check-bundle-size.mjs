import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST_ASSETS = join(process.cwd(), 'dist', 'assets')
const DIST_INDEX_HTML = join(process.cwd(), 'dist', 'index.html')
const ENTRY_GZIP_BUDGET_KB = 100
const TOTAL_JS_GZIP_BUDGET_KB = 1300

const toKb = (bytes) => Number((bytes / 1024).toFixed(2))

const files = readdirSync(DIST_ASSETS)
const jsFiles = files.filter((file) => file.endsWith('.js'))
const html = readFileSync(DIST_INDEX_HTML, 'utf8')
const entryMatch = html.match(/src="\/assets\/([^"]+\.js)"/)
const entryFile = entryMatch?.[1]

if (!entryFile) {
  throw new Error('Unable to find entry chunk (index-*.js) in dist/assets')
}

let totalJsGzipBytes = 0
for (const file of jsFiles) {
  const buffer = readFileSync(join(DIST_ASSETS, file))
  totalJsGzipBytes += gzipSync(buffer).length
}

const entryPath = join(DIST_ASSETS, entryFile)
const entryRawBytes = statSync(entryPath).size
const entryGzipBytes = gzipSync(readFileSync(entryPath)).length

const entryRawKb = toKb(entryRawBytes)
const entryGzipKb = toKb(entryGzipBytes)
const totalJsGzipKb = toKb(totalJsGzipBytes)

console.log(`Entry JS (raw): ${entryRawKb} KB`)
console.log(`Entry JS (gzip): ${entryGzipKb} KB`)
console.log(`Total JS (gzip): ${totalJsGzipKb} KB`)
console.log(`Budgets -> entry gzip <= ${ENTRY_GZIP_BUDGET_KB} KB, total js gzip <= ${TOTAL_JS_GZIP_BUDGET_KB} KB`)

const failures = []
if (entryGzipKb > ENTRY_GZIP_BUDGET_KB) {
  failures.push(`Entry gzip ${entryGzipKb} KB exceeds ${ENTRY_GZIP_BUDGET_KB} KB`)
}
if (totalJsGzipKb > TOTAL_JS_GZIP_BUDGET_KB) {
  failures.push(`Total JS gzip ${totalJsGzipKb} KB exceeds ${TOTAL_JS_GZIP_BUDGET_KB} KB`)
}

if (failures.length > 0) {
  console.error('\nSize budget check failed:')
  for (const message of failures) {
    console.error(`- ${message}`)
  }
  process.exit(1)
}

console.log('\nSize budget check passed.')
