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

test('AVI 설정은 기간 저장, 예외 기준 등록, 상세 결과 보기를 제공한다', async () => {
  const source = await readFile(new URL('./SettingsPage.tsx', import.meta.url), 'utf8')
  const start = source.lastIndexOf('function VarianceSettings')
  const end = source.indexOf('function Segmented', start)
  const aviComponent = source.slice(start, end)

  assert.match(aviComponent, /api\.get(?:<[^>]+>)?\(\s*["']\/variance-settings\/current/)
  assert.match(aviComponent, /api\.put\(\s*`\/variance-settings\/current\/\$\{company\.id\}`/)
  assert.match(aviComponent, /예외 기준 추가/)
  assert.match(aviComponent, /상세 결과 보기/)
})
