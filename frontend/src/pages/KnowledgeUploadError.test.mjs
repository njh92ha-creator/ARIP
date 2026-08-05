import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('duplicate knowledge document upload shows a dismissible error dialog', async () => {
  const source = await readFile(new URL('./SettingsPage.tsx', import.meta.url), 'utf8')
  const start = source.indexOf('function KnowledgeSettings')
  const end = source.indexOf('function KnowledgeKpi', start)
  const component = source.slice(start, end)

  assert.match(component, /setUploadDialogMessage/)
  assert.match(component, /open=\{Boolean\(uploadDialogMessage\)\}/)
  assert.match(component, /onClick=\{\(\) => setUploadDialogMessage\(""\)\}/)
  assert.match(component, /response\?\.data\?\.detail/)
})
