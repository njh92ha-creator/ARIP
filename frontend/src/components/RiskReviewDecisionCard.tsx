import { Alert, Box, Button, ButtonGroup, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api, Risk } from '../api'

const decisions = ['CHECK', 'PENDING', 'PASS'] as const
const labels = { CHECK: 'Check', PENDING: 'Pending', PASS: 'Pass' }

export function RiskReviewDecisionCard({ risk }: { risk: Risk }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: async (decision: typeof decisions[number]) => (await api.post<Risk>(`/risks/${risk.id}/review-decision`, { decision, expected_version: risk.row_version })).data,
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ['risks'] })
      await queryClient.invalidateQueries({ queryKey: ['risk-reviews'] })
      if (updated.review_decision === 'PASS') navigate('/risks')
      else queryClient.setQueryData(['risk', risk.id], updated)
    },
  })
  const current = risk.review_decision ?? 'CHECK'
  return <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent sx={{ p: 2.5 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ sm: 'center' }}>
      <Box><Typography fontWeight={700}>검토 분류</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>Pass를 선택하면 리스크 관리와 리스크 검토 목록에서 숨겨집니다.</Typography></Box>
      <ButtonGroup disabled={mutation.isPending}>
        {decisions.map((decision) => <Button key={decision} variant={current === decision ? 'contained' : 'outlined'} color={decision === 'PASS' ? 'success' : decision === 'PENDING' ? 'warning' : 'primary'} onClick={() => mutation.mutate(decision)}>{labels[decision]}</Button>)}
      </ButtonGroup>
    </Stack>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}><Chip size="small" label={`현재: ${labels[current]}`} />
      {risk.review_recommendation && <Typography variant="body2" color="text.secondary">추천: {labels[risk.review_recommendation.decision]} (유사 사례 {risk.review_recommendation.matched_cases}건, 신뢰도 {Math.round(risk.review_recommendation.confidence * 100)}%)</Typography>}
    </Stack>
    {mutation.isError && <Alert severity="error" sx={{ mt: 2 }}>검토 분류 저장에 실패했습니다. 새로고침 후 다시 시도해 주세요.</Alert>}
    {risk.review_recommendation?.decision_counts && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>누적 결정: Check {risk.review_recommendation.decision_counts.CHECK}건 · Pending {risk.review_recommendation.decision_counts.PENDING}건 · Pass {risk.review_recommendation.decision_counts.PASS}건</Typography>}
  </CardContent></Card>
}
