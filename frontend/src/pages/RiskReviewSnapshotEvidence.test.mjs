import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { build } from 'esbuild'
import test from 'node:test'

const require = createRequire(import.meta.url)

async function loadSnapshotEvidence() {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./RiskReviewSnapshotEvidence.tsx', import.meta.url))],
    bundle: true,
    format: 'cjs',
    jsx: 'automatic',
    platform: 'node',
    packages: 'external',
    write: false,
  })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(
    module,
    module.exports,
    require,
  )
  return module.exports.RiskReviewSnapshotEvidence
}

test('snapshot evidence renders copied ledger rows and legacy references', async () => {
  const RiskReviewSnapshotEvidence = await loadSnapshotEvidence()
  const html = renderToStaticMarkup(createElement(RiskReviewSnapshotEvidence, {
    package: {
      ledger_evidence: [{
        documentNumber: 'JE-2026-0042',
        postingDate: '2026-08-11',
        accountName: '단기차입금',
        debitCredit: 'C',
        amount: '100000000',
        description: '운전자금 차입',
      }],
      standards_evidence: [],
      references: [{
        title: 'K-IFRS 제1001호 문단 69',
        url: 'https://example.test/k-ifrs-1001-69',
      }],
    },
  }))

  assert.match(html, /JE-2026-0042/)
  assert.match(html, /단기차입금/)
  assert.match(html, /운전자금 차입/)
  assert.match(html, /K-IFRS 제1001호 문단 69/)
  assert.match(html, /https:\/\/example\.test\/k-ifrs-1001-69/)
})

test('review detail delegates immutable evidence rendering to the rendered component', async () => {
  const detail = await readFile(new URL('./RiskReviewDetailPage.tsx', import.meta.url), 'utf8')

  assert.match(detail, /<RiskReviewSnapshotEvidence package=\{pkg\} \/>/)
})
