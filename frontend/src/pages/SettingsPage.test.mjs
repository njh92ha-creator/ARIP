import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('회사 현황의 각 행에는 회사 관리 버튼이 있다', async () => {
  const source = await readFile(new URL('./SettingsPage.tsx', import.meta.url), 'utf8')

  assert.match(source, /aria-label="회사 정보 관리"/)
  assert.match(source, /onClick=\{\(\) => onManage\(item\)\}/)
})
