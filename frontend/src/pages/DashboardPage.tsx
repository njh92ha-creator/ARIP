import { Alert, Box, Card, CardContent, Grid, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { api, Company } from '../api'
import { KpiCard } from '../components/KpiCard'

export function DashboardPage() {
  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get<Company[]>('/companies')).data,
  })
  const company = companies.data?.[0]
  const dashboard = useQuery({
    queryKey: ['dashboard', company?.id],
    enabled: Boolean(company),
    queryFn: async () => (await api.get('/dashboard', { params: { company_id: company!.id } })).data,
  })
  if (!company) {
    return (
      <Alert severity="info">
        먼저 Settings에서 회사와 회계연도를 등록해 주세요.
      </Alert>
    )
  }
  const data = dashboard.data ?? {}
  return (
    <Box>
      <Typography variant="h4">결산 통제 Dashboard</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        {company.company_name} · 집계 기준: {data.dataAsOf ?? '조회 중'}
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}><KpiCard label="총 Risk" value={data.totalRisks ?? 0} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><KpiCard label="High Risk" value={data.highRisks ?? 0} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><KpiCard label="미조치 Risk" value={data.openRisks ?? 0} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><KpiCard label="Accounting Event" value={data.events ?? 0} /></Grid>
      </Grid>
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6">분석 경로 분포</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Reuse와 Template은 자동 승인 의미가 아니며, 모든 결과는 담당자 검토 대상입니다.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
            {Object.entries(data.routeDistribution ?? {}).map(([route, count]) => (
              <KpiCard key={route} label={route} value={String(count)} />
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

