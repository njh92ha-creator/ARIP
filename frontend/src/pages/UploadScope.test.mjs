import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('upload analysis does not select or submit a fiscal period', async () => {
  const source = await readFile(new URL('./UploadPage.tsx', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /useState\(new Date\(\)\.getFullYear\(\)\)/)
  assert.doesNotMatch(source, /form\.append\('fiscal_year'/)
  assert.doesNotMatch(source, /form\.append\('fiscal_period'/)
  assert.doesNotMatch(source, /general ledger fiscal year\/period does not match/)
})
