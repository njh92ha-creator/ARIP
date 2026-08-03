import { Alert, Box, Card, CardContent, Chip, Grid, LinearProgress, Stack, Typography } from '@mui/material'
import { AnalyticsOutlined, CalendarMonthOutlined, CheckCircleOutline, ErrorOutline, TrendingUpOutlined } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { api, Company } from '../api'
import { KpiCard } from '../components/KpiCard'

const routeName = (route: string) => ({ REUSE: '기존 패턴 재사용', TEMPLATE: '템플릿 적용', MANUAL: '수동 검토' }[route] ?? route)

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

  if (!company) return <Alert severity="info">먼저 설정에서 회사와 회계연도 정보를 등록해주세요.</Alert>

  const data = dashboard.data ?? {}
  const routes = Object.entries(data.routeDistribution ?? {}) as [string, number][]
  const routeTotal = routes.reduce((sum, [, count]) => sum + Number(count), 0)
  const summaryDate = data.dataAsOf ?? '조회 중'

  return (
    <Box sx={{ pb: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4">대시보드</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>{company.company_name}의 감사 리스크 현황을 한눈에 확인하세요.</Typography>
        </Box>
        <Chip icon={<CalendarMonthOutlined />} label={`데이터 기준일: ${summaryDate}`} variant="outlined" sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, bgcolor: '#FFFFFF', borderColor: '#E5E7EB', fontWeight: 600 }} />
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiCard label="전체 리스크" value={data.totalRisks ?? 0} helper="현재 관리 대상" tone="primary" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiCard label="고위험 리스크" value={data.highRisks ?? 0} helper="우선 검토 필요" tone="error" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiCard label="미조치 리스크" value={data.openRisks ?? 0} helper="담당자 조치 대기" tone="warning" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiCard label="회계 사건" value={data.events ?? 0} helper="분석 완료 사건" tone="success" /></Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <Box sx={{ px: 2.5, py: 2.25, borderBottom: '1px solid #E5E7EB' }}><Typography variant="h6">분석 경로 분포</Typography></Box>
              <Stack spacing={2.25} sx={{ p: 2.5 }}>
                {routes.length ? routes.map(([route, count], index) => {
                  const value = Number(count)
                  const percentage = routeTotal ? Math.round((value / routeTotal) * 100) : 0
                  const color = ['#1F6FD5', '#7C3AED', '#667085'][index % 3]
                  return <Box key={route}>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.8 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{routeName(route)}</Typography>
                      <Typography variant="body2"><Box component="span" sx={{ fontWeight: 700 }}>{value}</Box><Box component="span" color="text.secondary">건 · {percentage}%</Box></Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={percentage} sx={{ height: 8, borderRadius: 99, bgcolor: '#EEF2F6', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 99 } }} />
                  </Box>
                }) : <Box sx={{ py: 3, textAlign: 'center' }}><AnalyticsOutlined sx={{ color: '#98A2B3', mb: 1 }} /><Typography color="text.secondary" variant="body2">표시할 분석 경로 데이터가 없습니다.</Typography></Box>}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <Box sx={{ px: 2.5, py: 2.25, borderBottom: '1px solid #E5E7EB' }}><Typography variant="h6">리스크 관리 현황</Typography></Box>
              <Stack spacing={0} divider={<Box sx={{ borderBottom: '1px solid #E5E7EB' }} />}>
                <DashboardRow icon={<ErrorOutline />} title="우선 확인할 고위험 리스크" value={`${data.highRisks ?? 0}건`} color="#E53935" description="고위험 및 중요 리스크는 검토 우선순위를 확인하세요." />
                <DashboardRow icon={<TrendingUpOutlined />} title="조치가 필요한 리스크" value={`${data.openRisks ?? 0}건`} color="#F59E0B" description="미조치 항목의 담당자와 후속 조치 계획을 점검하세요." />
                <DashboardRow icon={<CheckCircleOutline />} title="수집된 회계 사건" value={`${data.events ?? 0}건`} color="#16A34A" description="사건별 증빙과 분석 결과는 해당 메뉴에서 확인할 수 있습니다." />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mt: 2.5, overflow: 'hidden', borderColor: 'rgba(31, 111, 213, 0.24)', bgcolor: 'rgba(31, 111, 213, 0.045)' }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Stack direction="row" spacing={1} alignItems="center"><AnalyticsOutlined sx={{ color: '#1F6FD5' }} /><Typography variant="h6" sx={{ color: '#0056B0' }}>AI 분석 요약</Typography><Chip label="BETA" size="small" sx={{ height: 21, bgcolor: '#1F6FD5', color: '#FFFFFF', fontSize: 10, fontWeight: 700 }} /></Stack>
          <Typography color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.75 }}>
            현재 집계 기준으로 전체 {data.totalRisks ?? 0}건의 리스크 중 고위험 리스크는 {data.highRisks ?? 0}건이며, 미조치 리스크는 {data.openRisks ?? 0}건입니다. 최종 판단 전 담당자가 근거 자료와 조치 현황을 검토해주세요.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, pt: 1.5, borderTop: '1px solid rgba(31, 111, 213, 0.14)' }}>최근 집계 시점: {summaryDate} · 본 요약은 데이터 집계를 보조하는 정보입니다.</Typography>
        </CardContent>
      </Card>
    </Box>
  )
}

function DashboardRow({ icon, title, value, color, description }: { icon: React.ReactNode; title: string; value: string; color: string; description: string }) {
  return <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 2.5 }}>
    <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', color, bgcolor: `${color}14` }}>{icon}</Box>
    <Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="body2" sx={{ fontWeight: 700 }}>{title}</Typography><Typography variant="caption" color="text.secondary">{description}</Typography></Box>
    <Typography sx={{ fontSize: 20, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{value}</Typography>
  </Stack>
}
