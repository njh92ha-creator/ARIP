import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readSources = async () => Promise.all([
  readFile(new URL('../App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./RiskReviewPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./RiskReviewDetailPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/RiskReviewDecisionCard.tsx', import.meta.url), 'utf8'),
])

test('review workspace uses the transferred-case route, API, and business risk code', async () => {
  const [app, list, detail, decisionCard] = await readSources()

  assert.match(app, /path="risk-reviews\/:riskCode" element=\{<RiskReviewDetailPage \/>\}/)
  assert.match(list, /api\.get<RiskReviewSummary\[\]>\('\/risk-reviews'/)
  assert.match(list, /to=\{`\/risk-reviews\/\$\{encodeURIComponent\(reviewCase\.risk_code\)\}`\}/)
  assert.match(list, /\{reviewCase\.risk_code \|\| '-'\}/)
  assert.doesNotMatch(list, />\{reviewCase\.id\}</)
  assert.match(detail, /const \{ riskCode \} = useParams/)
  assert.match(detail, /api\.get<RiskReviewCase>\(\s*`\/risk-reviews\/\$\{encodeURIComponent\(riskCode!\)\}`/)
  assert.match(detail, /api\.put<RiskReviewAnswer>\(\s*`\/risk-reviews\/\$\{reviewCaseId\}\/answers`/)
  assert.match(detail, /attachments\.length\} \/ 10/)
  assert.match(decisionCard, /navigate\(`\/risk-reviews\/\$\{encodeURIComponent\(reviewCase\.risk_code\)\}`\)/)
})

test('answer save preserves edits typed after the request starts', async () => {
  const [, , detail] = await readSources()
  const start = detail.indexOf('function AnswerEditor')
  const end = detail.indexOf('function SnapshotCard', start)
  const editor = detail.slice(start, end)

  assert.match(editor, /mutationFn: async \(submittedAnswer: string\)/)
  assert.match(editor, /\{ question, answer: submittedAnswer \}/)
  assert.match(editor, /mutation\.mutate\(answer\)/)
  assert.match(editor, /mutation\.isSuccess && answer === mutation\.variables \? <Typography/)
  assert.doesNotMatch(editor, /\{mutation\.isSuccess \? <Typography/)
  assert.doesNotMatch(editor, /useEffect\(\(\) => \{\s*setAnswer\(savedAnswer\?\.answer/)
})

test('decision and severity mutations cannot restore the other control field', async () => {
  const [, , detail] = await readSources()

  assert.match(detail, /return \{ previousDecision: previous\?\.review_decision \}/)
  assert.match(detail, /review_decision: previousDecision/)
  assert.match(detail, /return \{ previousSeverity: previous\?\.severity \}/)
  assert.match(detail, /severity: previousSeverity/)
  assert.equal(detail.match(/disabled=\{controlsPending\}/g)?.length, 2)
})

test('review list load errors are exclusive of setup and empty states', async () => {
  const [, list] = await readSources()

  assert.match(list, /const hasLoadError = isCompanyError \|\| isPrincipalError \|\| isError/)
  assert.match(list, /\{hasLoadError \? <Alert/)
  assert.match(list, /: !isScopeLoading && !company \? <Alert/)
  assert.doesNotMatch(list, /\{isCompanyError \|\| isError \? <Alert/)
})

test('review pages select only a company authorized by auth me', async () => {
  const [, list, detail] = await readSources()

  for (const source of [list, detail]) {
    assert.match(source, /api\.get<AuthPrincipal>\('\/auth\/me'\)/)
    assert.match(source, /selectAuthenticatedCompany\(companies, principal\)/)
    assert.doesNotMatch(source, /const company = companies\?\.\[0\]/)
    assert.doesNotMatch(source, /companyScope/)
  }
})
