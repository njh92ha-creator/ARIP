import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('knowledge base KPIs use the current document candidates', async () => {
  const source = await readFile(new URL('./SettingsPage.tsx', import.meta.url), 'utf8')
  const start = source.indexOf('function KnowledgeSettings')
  const end = source.indexOf('function KnowledgeKpi', start)
  const component = source.slice(start, end)

  assert.match(component, /local-standards\/candidates/)
  assert.match(component, /status === "APPROVED"/)
  assert.match(component, /status === "PENDING"/)
  assert.match(component, /ragEligible/)
  assert.doesNotMatch(component, /value="18"/)
  assert.doesNotMatch(component, /value="4"/)
  assert.doesNotMatch(component, /총 22건/)
})
