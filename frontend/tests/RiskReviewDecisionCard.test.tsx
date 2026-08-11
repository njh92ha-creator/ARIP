import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { api, Risk } from '../src/api'
import { RiskReviewDecisionCard } from '../src/components/RiskReviewDecisionCard'

vi.mock('../src/api', () => ({
  api: { post: vi.fn() },
}))

const risk: Risk = {
  id: 'risk-1',
  risk_code: 'LI_20260811_001',
  title: '검토 대상 리스크',
  statement: '명시적 선택이 필요합니다.',
  level: 'HIGH',
  score: 80,
  route: 'REVIEW',
  status: 'OPEN',
  materiality_level: 'HIGH',
  row_version: 1,
  review_decision: 'CHECK',
  severity: 'HIGH',
  package: {
    summary: '', references: [], expected_questions: [], evidence_checklist: [],
    response_guidance: [], generated_by: '', missing_facts: [], evidence_status: 'READY',
  },
}

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <RiskReviewDecisionCard risk={risk} />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('RiskReviewDecisionCard', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockImplementation(async (path, payload) => ({
      data: path.endsWith('/review-decision')
        ? { ...risk, review_decision: (payload as { decision: Risk['review_decision'] }).decision }
        : { ...risk, severity: (payload as { severity: Risk['severity'] }).severity },
    }))
  })

  test('keeps the Korean transfer action disabled until Check or Pending and severity are explicitly saved here', async () => {
    renderCard()

    const transfer = screen.getByRole('button', { name: '검토 케이스로 이관' }) as HTMLButtonElement
    expect(transfer.disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Pending' }))
    await waitFor(() => expect(screen.getByText('현재: Pending')).toBeTruthy())
    expect(transfer.disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'High' }))
    await waitFor(() => expect(transfer.disabled).toBe(false))
  })
})
