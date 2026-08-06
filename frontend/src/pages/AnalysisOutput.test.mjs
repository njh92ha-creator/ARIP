import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('risk and event pages do not render static example analysis output', async () => {
  const [riskPage, eventPage] = await Promise.all([
    readFile(new URL('./RiskPages.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./EventPages.tsx', import.meta.url), 'utf8'),
  ])

  assert.doesNotMatch(riskPage, /value="2025-07"/)
  assert.doesNotMatch(riskPage, /\?\? \['김회계'/)
  assert.doesNotMatch(eventPage, /const events = \[\[/)
  assert.doesNotMatch(eventPage, /\['인건비','70%'/)
  assert.doesNotMatch(eventPage, /프로젝트 계획서\.pdf/)
  assert.doesNotMatch(eventPage, /2025-07-15/)
})

test('event details display related risks returned by the analysis API', async () => {
  const eventPage = await readFile(new URL('./EventPages.tsx', import.meta.url), 'utf8')

  assert.match(eventPage, /const relatedRisks = data\.relatedRisks \?\? \[\]/)
})
