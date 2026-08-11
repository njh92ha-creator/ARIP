import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import test from 'node:test'

const require = createRequire(import.meta.url)

async function loadSelector() {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../authenticatedCompany.ts', import.meta.url))],
    bundle: true,
    format: 'cjs',
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
  return module.exports.selectAuthenticatedCompany
}

test('authenticated company selection ignores an unauthorized first company', async () => {
  const selectAuthenticatedCompany = await loadSelector()
  const companies = [
    { id: 'company-first', company_name: 'Unauthorized first company' },
    { id: 'company-authorized', company_name: 'Authorized company' },
  ]
  const principal = {
    companyId: 'company-authorized',
    companyIds: ['company-authorized'],
  }

  assert.equal(selectAuthenticatedCompany(companies, principal), companies[1])
})

test('authenticated company selection fails closed without a server-selected scope', async () => {
  const selectAuthenticatedCompany = await loadSelector()
  const companies = [{ id: 'company-first', company_name: 'Company' }]

  assert.equal(
    selectAuthenticatedCompany(companies, { companyId: null, companyIds: [] }),
    undefined,
  )
})
