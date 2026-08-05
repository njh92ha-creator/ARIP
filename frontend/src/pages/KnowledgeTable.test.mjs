import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('knowledge table renders only the current uploaded documents', async () => {
  const source = await readFile(new URL('./SettingsPage.tsx', import.meta.url), 'utf8')
  const settingsStart = source.indexOf('function KnowledgeSettings')
  const settingsEnd = source.indexOf('function KnowledgeKpi', settingsStart)
  const settings = source.slice(settingsStart, settingsEnd)
  const tableStart = source.indexOf('function KnowledgeTable')
  const tableEnd = source.indexOf('function StatusChip', tableStart)
  const table = source.slice(tableStart, tableEnd)

  assert.match(settings, /<KnowledgeTable documents=\{candidateItems\}/)
  assert.match(table, /function KnowledgeTable\(\{ documents \}/)
  assert.doesNotMatch(table, /const rows = \[/)
  assert.doesNotMatch(table, /K-IFRS/)
})
