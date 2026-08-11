import { Alert, Box, Button, ButtonGroup, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { api, companyScope, Risk, RiskReviewCase, RiskReviewTransfer } from '../api'

const decisions = ['CHECK', 'PENDING', 'PASS'] as const
const labels = { CHECK: 'Check', PENDING: 'Pending', PASS: 'Pass' }
const severities = ['HIGH', 'MEDIUM', 'LOW'] as const
const severityLabels = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' }

export function RiskReviewDecisionCard({ risk }: { risk: Risk }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [savedDecision, setSavedDecision] = useState<typeof decisions[number]>()
  const [savedSeverity, setSavedSeverity] = useState<typeof severities[number]>()
  const mutation = useMutation({
    mutationFn: async (decision: typeof decisions[number]) => (await api.post<Risk>(`/risks/${risk.id}/review-decision`, { decision, expected_version: risk.row_version })).data,
    onSuccess: async (updated) => {
      setSavedDecision(updated.review_decision)
      await queryClient.invalidateQueries({ queryKey: ['risks'] })
      await queryClient.invalidateQueries({ queryKey: ['risk-reviews'] })
      if (updated.review_decision === 'PASS') navigate('/risks')
      else queryClient.setQueryData(['risk', risk.id], updated)
    },
  })
  const severityMutation = useMutation({
    mutationFn: async (severity: typeof severities[number]) => (await api.post<Risk>(`/risks/${risk.id}/severity`, { severity, expected_version: risk.row_version })).data,
    onSuccess: async (updated) => {
      setSavedSeverity(updated.severity)
      await queryClient.invalidateQueries({ queryKey: ['risks'] })
      await queryClient.invalidateQueries({ queryKey: ['risk-reviews'] })
      queryClient.setQueryData(['risk', risk.id], updated)
    },
  })
  const transferMutation = useMutation({
    mutationFn: async (transfer: RiskReviewTransfer) => (await api.post<RiskReviewCase>(
      `/risks/${risk.id}/transfer-to-review`,
      transfer,
      companyScope(risk.company_id),
    )).data,
    onSuccess: async (reviewCase) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['risks'] }),
        queryClient.invalidateQueries({ queryKey: ['risk-reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['risk-management'] }),
      ])
      navigate(`/risk-reviews/${encodeURIComponent(reviewCase.risk_code)}`)
    },
  })
  const current = savedDecision ?? risk.review_decision ?? 'CHECK'
  const severity = savedSeverity ?? risk.severity ?? risk.level as typeof severities[number]
  const canTransfer = Boolean(savedDecision && savedDecision !== 'PASS' && savedSeverity)
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
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ sm: 'center' }} sx={{ mt: 3, pt: 2, borderTop: '1px solid #E5E7EB' }}>
      <Box><Typography fontWeight={700}>심각도</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>사용자 선택값을 같은 회계이슈 유형의 누적 사례와 비교해 추천합니다.</Typography></Box>
      <ButtonGroup disabled={severityMutation.isPending}>{severities.map((item) => <Button key={item} variant={severity === item ? 'contained' : 'outlined'} color={item === 'HIGH' ? 'error' : item === 'MEDIUM' ? 'warning' : 'success'} onClick={() => severityMutation.mutate(item)}>{severityLabels[item]}</Button>)}</ButtonGroup>
    </Stack>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}><Chip size="small" label={`현재: ${severityLabels[severity]}`} />
      {risk.severity_recommendation && <Typography variant="body2" color="text.secondary">추천: {severityLabels[risk.severity_recommendation.severity]} (유사 사례 {risk.severity_recommendation.matched_cases}건, 신뢰도 {Math.round(risk.severity_recommendation.confidence * 100)}%)</Typography>}
    </Stack>
    {severityMutation.isError && <Alert severity="error" sx={{ mt: 2 }}>심각도 저장에 실패했습니다. 새로고침 후 다시 시도해 주세요.</Alert>}
    {risk.severity_recommendation?.severity_counts && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>누적 선택: High {risk.severity_recommendation.severity_counts.HIGH}건 · Medium {risk.severity_recommendation.severity_counts.MEDIUM}건 · Low {risk.severity_recommendation.severity_counts.LOW}건</Typography>}
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ sm: 'center' }} sx={{ mt: 3, pt: 2, borderTop: '1px solid #E5E7EB' }}>
      <Box><Typography fontWeight={700}>검토 케이스 이관</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>이 화면에서 Check 또는 Pending과 심각도를 저장한 뒤 검토 케이스로 이관할 수 있습니다.</Typography></Box>
      <Button variant="contained" onClick={() => savedDecision && savedDecision !== 'PASS' && savedSeverity && transferMutation.mutate({ review_decision: savedDecision, severity: savedSeverity })} disabled={!canTransfer || transferMutation.isPending || mutation.isPending || severityMutation.isPending}>검토 케이스로 이관</Button>
    </Stack>
    {transferMutation.isError && <Alert severity="error" sx={{ mt: 2 }}>검토 케이스 이관에 실패했습니다. 선택 값을 확인한 뒤 다시 시도해 주세요.</Alert>}
  </CardContent></Card>
}
