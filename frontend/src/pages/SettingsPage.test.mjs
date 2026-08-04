import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('회사 현황의 각 행에는 회사 관리 버튼이 있다', async () => {
  const source = await readFile(new URL('./SettingsPage.tsx', import.meta.url), 'utf8')

  assert.match(source, /aria-label="회사 정보 관리"/)
  assert.match(source, /onClick=\{\(\) => onManage\(item\)\}/)
})

test('감사 중요성은 현재 기준을 조회하고 검토 후 저장만 제공한다', async () => {
  const source = await readFile(new URL('./SettingsPage.tsx', import.meta.url), 'utf8')
  const start = source.lastIndexOf('function MaterialitySettings')
  const end = source.indexOf('function HistoryRow', start)
  const materialityComponent = source.slice(start, end)

  assert.match(materialityComponent, /api\.get(?:<[^>]+>)?\(\s*["']\/settings\/materiality/)
  assert.match(materialityComponent, /api\.put\(\s*`\/settings\/materiality\/\$\{company\.id\}`/)
  assert.doesNotMatch(materialityComponent, /임시 저장/)
})

test('AI 연결 설정은 저장과 연결 테스트 요청을 연결한다', async () => {
  const source = await readFile(new URL('./SettingsPage.tsx', import.meta.url), 'utf8')
  const start = source.indexOf('function AiSettings')
  const end = source.indexOf('function KnowledgeSettings', start)
  const aiComponent = source.slice(start, end)

  assert.match(aiComponent, /api\.patch\("\/settings\/ai-connection"/)
  assert.match(aiComponent, /api\.post\("\/settings\/ai-connection\/test"/)
  assert.match(aiComponent, /onClick=\{\(\) => void testConnection\(\)\}/)
})
