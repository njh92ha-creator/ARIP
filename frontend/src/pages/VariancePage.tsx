import { Alert, Box, Card, CardContent, Chip, Grid, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { AutoGraphOutlined, InfoOutlined } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { api, Company } from '../api'
import { KpiCard } from '../components/KpiCard'
import { StatusBadge } from '../components/StatusBadge'

export function VariancePage() {
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<Company[]>('/companies')).data })
  const company = companies?.[0]
  const { data } = useQuery({
    queryKey: ['variance-dashboard', company?.id],
    enabled: Boolean(company),
    queryFn: async () => (await api.get('/account-variance/dashboard', { params: { company_id: company!.id } })).data,
  })
  const observations = data?.observations ?? []
  return <Box sx={{ maxWidth: 1720, mx: 'auto' }}>
    <Box sx={{ mb: 3 }}><Typography variant="h4">계정 증감 인텔리전스</Typography><Typography color="text.secondary" sx={{ mt: 0.75 }}>계정의 금액 및 증감률 변화를 검토하기 위한 AVI 관측치 화면입니다.</Typography></Box>
    <Alert severity="info" icon={<InfoOutlined fontSize="inherit" />} sx={{ mb: 3, border: '1px solid #BFDBFE', bgcolor: '#EFF6FF', color: '#124F9E' }}>AVI 관측치는 증감 원인을 확인하기 위한 정량 신호입니다. 담당자가 명시적으로 연결하기 전에는 Audit Risk로 자동 생성되지 않습니다.</Alert>
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, md: 4 }}><KpiCard label="관측 대상 계정" value={data?.flaggedAccounts ?? 0} tone="primary" /></Grid>
      <Grid size={{ xs: 12, md: 4 }}><KpiCard label="증감 노출 금액" value={Number(data?.exposureAmount ?? 0).toLocaleString()} tone="warning" /></Grid>
      <Grid size={{ xs: 12, md: 4 }}><KpiCard label="리스크 분리 상태" value="독립" helper={data?.riskSeparation ?? 'AVI 관측치는 Audit Risk와 분리되어 관리됩니다.'} tone="success" /></Grid>
    </Grid>
    <Card>
      <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5}><Box><Typography variant="h6">계정 증감 관측치</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{company ? `${company.company_name}의 현재 분석 결과` : '회사를 불러오는 중입니다.'}</Typography></Box><Chip icon={<AutoGraphOutlined />} label="AVI 전용" color="primary" variant="outlined" /></Stack></Box>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <Box sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 920 }}><TableHead><TableRow><TableCell>계정</TableCell><TableCell>분류 / 기준</TableCell><TableCell align="right">현재 값</TableCell><TableCell align="right">비교 값</TableCell><TableCell align="right">증감액</TableCell><TableCell align="right">증감률</TableCell><TableCell>감지 기준</TableCell><TableCell>검토 상태</TableCell></TableRow></TableHead>
          <TableBody>{observations.length ? observations.map((o: any) => <TableRow key={o.id} hover><TableCell><Typography variant="body2" fontWeight={700}>{o.account_name}</Typography><Typography variant="caption" color="text.secondary">{o.account_code}</Typography></TableCell><TableCell><Typography variant="body2">{o.category}</Typography><Typography variant="caption" color="text.secondary">{o.measurement_basis}</Typography></TableCell><TableCell align="right">{Number(o.current_value).toLocaleString()}</TableCell><TableCell align="right">{Number(o.comparison_value).toLocaleString()}</TableCell><TableCell align="right" sx={{ color: Number(o.delta_amount) < 0 ? 'error.main' : 'text.primary', fontWeight: 700 }}>{Number(o.delta_amount).toLocaleString()}</TableCell><TableCell align="right">{o.delta_rate == null ? '—' : `${(Number(o.delta_rate) * 100).toFixed(1)}%`}</TableCell><TableCell>{o.triggered_by.join(', ')}</TableCell><TableCell><StatusBadge value={o.review_status} /></TableCell></TableRow>) : <TableRow><TableCell colSpan={8} align="center" sx={{ py: 7 }}><Typography color="text.secondary">표시할 AVI 관측치가 없습니다.</Typography><Typography variant="caption" color="text.secondary">AVI 기준을 설정하고 분석을 실행하면 이곳에서 결과를 검토할 수 있습니다.</Typography></TableCell></TableRow>}</TableBody>
        </Table></Box>
      </CardContent>
    </Card>
  </Box>
}
