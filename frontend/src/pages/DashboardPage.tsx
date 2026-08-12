import { Alert, Box, Card, CardContent, Chip, CircularProgress, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, Company, RiskReviewSummary } from '../api'

const cardSx = { border: '1px solid #E5E7EB', borderRadius: 3, boxShadow: '0 1px 2px rgba(16,24,40,.05)' }
const severityColor = { HIGH: 'error', MEDIUM: 'warning', LOW: 'success' } as const

function formatAmount(value: number) {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return <Card sx={cardSx}><CardContent sx={{ minHeight: 104, p: 2.5, '&:last-child': { pb: 2.5 } }}>
    <Typography color="text.secondary" variant="body2">{label}</Typography>
    <Typography sx={{ mt: 1, color: tone ?? '#101828', fontSize: 28, fontWeight: 700 }}>{value}</Typography>
  </CardContent></Card>
}

export function DashboardPage() {
  const companies = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<Company[]>('/companies')).data })
  const company = companies.data?.[0]
  const reviews = useQuery({
    queryKey: ['risk-reviews', company?.id],
    enabled: Boolean(company),
    queryFn: async () => (await api.get<RiskReviewSummary[]>('/risk-reviews', { params: { company_id: company!.id } })).data,
  })

  if (!companies.isPending && !company) return <Alert severity="info">먼저 설정에서 회사를 등록해 주세요.</Alert>
  if (companies.isPending || reviews.isPending) return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box>
  if (reviews.isError) return <Alert severity="error">리스크 검토 데이터를 불러오지 못했습니다.</Alert>

  const items = reviews.data ?? []
  const totalExposure = items.reduce((sum, item) => sum + (item.exposure_amount || 0), 0)
  const high = items.filter((item) => item.severity === 'HIGH').length
  const medium = items.filter((item) => item.severity === 'MEDIUM').length
  const low = items.filter((item) => item.severity === 'LOW').length
  const check = items.filter((item) => item.review_decision === 'CHECK').length
  const pending = items.filter((item) => item.review_decision === 'PENDING').length
  const latest = [...items].sort((a, b) => new Date(b.transferred_at).getTime() - new Date(a.transferred_at).getTime()).slice(0, 5)
  const latestDate = latest[0]?.transferred_at ? formatDate(latest[0].transferred_at) : '-'

  return <Box sx={{ maxWidth: 1440, mx: 'auto', pb: 4 }}>
    <Typography variant="h4" fontWeight={700}>대시보드</Typography>
    <Typography color="text.secondary" sx={{ mt: .75 }}>리스크 검토에 이관된 감사 이슈 현황입니다. 기준일: {latestDate}</Typography>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 2, mt: 3 }}>
      <Kpi label="전체 리스크" value={items.length} />
      <Kpi label="High 리스크" value={high} tone="#D92D20" />
      <Kpi label="리스크 노출금액" value={formatAmount(totalExposure)} />
      <Kpi label="Check" value={check} tone="#0056B0" />
      <Kpi label="Pending" value={pending} tone="#B54708" />
    </Box>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '4fr 8fr' }, gap: 3, mt: 3 }}>
      <Card sx={cardSx}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography fontWeight={700}>심각도 분포</Typography>
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <Stack direction="row" justifyContent="space-between"><Typography>High</Typography><Typography fontWeight={700} color="error.main">{high}건</Typography></Stack>
          <Stack direction="row" justifyContent="space-between"><Typography>Medium</Typography><Typography fontWeight={700} color="warning.main">{medium}건</Typography></Stack>
          <Stack direction="row" justifyContent="space-between"><Typography>Low</Typography><Typography fontWeight={700} color="success.main">{low}건</Typography></Stack>
        </Stack>
      </CardContent></Card>

      <Card sx={cardSx}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography fontWeight={700}>주요 리스크</Typography>
        <Stack spacing={1} sx={{ mt: 2 }}>
          {latest.length ? latest.map((item) => <Box key={item.risk_code} component={Link} to={`/risk-reviews/${encodeURIComponent(item.risk_code)}`} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '140px minmax(0, 1fr) 130px 95px 105px' }, gap: 1.5, alignItems: 'center', p: 1.5, border: '1px solid #E5E7EB', borderRadius: 2, textDecoration: 'none', color: 'inherit', '&:hover': { bgcolor: '#F8FAFC' } }}>
            <Typography color="primary" fontWeight={700}>{item.risk_code}</Typography>
            <Typography noWrap title={item.title}>{item.title}</Typography>
            <Typography textAlign={{ md: 'right' }} fontWeight={700}>{formatAmount(item.exposure_amount || 0)}</Typography>
            <Chip label={item.severity} size="small" color={severityColor[item.severity]} />
            <Typography variant="body2" color="text.secondary">{formatDate(item.transferred_at)}</Typography>
          </Box>) : <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>이관된 리스크 검토가 없습니다.</Typography>}
        </Stack>
      </CardContent></Card>
    </Box>
  </Box>
}
