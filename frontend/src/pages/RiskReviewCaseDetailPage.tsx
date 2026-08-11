import { Alert, Box, Card, CardContent, Chip, CircularProgress, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api, RiskReviewCase } from '../api'

export function RiskReviewCaseDetailPage() {
  const { reviewCaseId } = useParams()
  const { data: reviewCase, isError } = useQuery({
    queryKey: ['risk-review', reviewCaseId],
    enabled: Boolean(reviewCaseId),
    queryFn: async () => (await api.get<RiskReviewCase>(`/risk-reviews/${reviewCaseId}`)).data,
  })

  if (isError) return <Alert severity="error">검토 케이스를 불러오지 못했습니다.</Alert>
  if (!reviewCase) return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress size={30} /></Box>

  return <Stack spacing={3}>
    <Box>
      <Typography variant="h4">{reviewCase.title}</Typography>
      <Typography color="text.secondary" sx={{ mt: .5 }}>리스크 ID · {reviewCase.risk_code}</Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
        <Chip label={reviewCase.review_decision} size="small" />
        <Chip label={reviewCase.severity} size="small" />
        <Chip label={reviewCase.status} size="small" />
      </Stack>
    </Box>
    <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent>
      <Typography fontWeight={700}>이관된 분석 결과</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>{reviewCase.statement}</Typography>
    </CardContent></Card>
  </Stack>
}
