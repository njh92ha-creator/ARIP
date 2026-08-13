import { Alert, Box, Card, CardContent, Chip, CircularProgress, Divider, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, Company, RiskReviewSummary } from '../api'

const cardSx = { border: '1px solid #E5E7EB', borderRadius: '12px', bgcolor: '#FFFFFF', boxShadow: '0 1px 2px rgba(16,24,40,.06)', overflow: 'hidden' }
const severityColor = { HIGH: 'error', MEDIUM: 'warning', LOW: 'success' } as const
const ring = 100.53

function formatAmount(value: number) { return `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value / 1_000_000)}백만원` }
function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}
function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return <Card sx={{ ...cardSx, minHeight: 118 }}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
    <Typography sx={{ color: '#667085', fontSize: 14 }}>{label}</Typography>
    <Typography sx={{ mt: 1, color: tone ?? '#101828', fontSize: 27, lineHeight: 1.2, fontWeight: 700 }}>{value}</Typography>
  </CardContent></Card>
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #E5E7EB' }}><Typography sx={{ fontSize: 18, fontWeight: 700 }}>{children}</Typography></Box>
}
function Legend({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const ratio = total ? Math.round((count / total) * 100) : 0
  return <Stack direction="row" alignItems="center" justifyContent="space-between"><Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 10, height: 10, bgcolor: color, borderRadius: '50%' }} /><Typography fontSize={14}>{label}</Typography></Stack><Typography fontSize={14} fontWeight={700}>{count}건 ({ratio}%)</Typography></Stack>
}
function ExposureBar({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const ratio = total ? Math.round((amount / total) * 100) : 0
  return <Box><Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}><Typography color="text.secondary" fontSize={12}>{label}</Typography><Typography fontSize={12} fontWeight={700}>{formatAmount(amount)}</Typography></Stack><Box sx={{ height: 8, borderRadius: 4, bgcolor: '#F2F4F7' }}><Box sx={{ width: `${ratio}%`, maxWidth: '100%', minWidth: amount ? 4 : 0, height: '100%', borderRadius: 4, bgcolor: color }} /></Box></Box>
}

export function DashboardPage() {
  const companies = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<Company[]>('/companies')).data })
  const company = companies.data?.[0]
  const reviews = useQuery({ queryKey: ['risk-reviews', company?.id, 'OPEN'], enabled: Boolean(company), queryFn: async () => (await api.get<RiskReviewSummary[]>('/risk-reviews', { params: { company_id: company!.id, status: 'OPEN' } })).data })
  if (!companies.isPending && !company) return <Alert severity="info">먼저 설정에서 회사를 등록해 주세요.</Alert>
  if (companies.isPending || reviews.isPending) return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box>
  if (reviews.isError) return <Alert severity="error">리스크 검토 데이터를 불러오지 못했습니다.</Alert>

  const items = reviews.data ?? []
  const high = items.filter((item) => item.severity === 'HIGH').length
  const medium = items.filter((item) => item.severity === 'MEDIUM').length
  const low = items.filter((item) => item.severity === 'LOW').length
  const highExposure = items.filter((item) => item.severity === 'HIGH').reduce((sum, item) => sum + (item.exposure_amount || 0), 0)
  const mediumExposure = items.filter((item) => item.severity === 'MEDIUM').reduce((sum, item) => sum + (item.exposure_amount || 0), 0)
  const lowExposure = items.filter((item) => item.severity === 'LOW').reduce((sum, item) => sum + (item.exposure_amount || 0), 0)
  const totalExposure = highExposure + mediumExposure + lowExposure
  const check = items.filter((item) => item.review_decision === 'CHECK').length
  const pending = items.filter((item) => item.review_decision === 'PENDING').length
  const latest = [...items].sort((a, b) => new Date(b.transferred_at).getTime() - new Date(a.transferred_at).getTime()).slice(0, 5)
  const latestDate = latest[0]?.transferred_at ? formatDate(latest[0].transferred_at) : '-'
  const highPct = items.length ? (high / items.length) * ring : 0
  const mediumPct = items.length ? (medium / items.length) * ring : 0
  const lowPct = Math.max(0, ring - highPct - mediumPct)

  return <Box sx={{ maxWidth: 1440, mx: 'auto', pb: 4, color: '#101828' }}>
    <Typography sx={{ fontSize: 28, fontWeight: 700 }}>대시보드</Typography>
    <Typography color="text.secondary" sx={{ mt: .75 }}>리스크 검토에 이관된 감사 이슈 현황입니다.</Typography>
    <Typography color="text.secondary" variant="caption" sx={{ display: 'block', mt: 1 }}>데이터 기준일: <Box component="span" color="#101828" fontWeight={700}>{latestDate}</Box></Typography>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 2, mt: 3 }}>
      <Kpi label="전체 리스크" value={items.length} /><Kpi label="High 리스크" value={high} tone="#D92D20" /><Kpi label="리스크 노출금액" value={formatAmount(totalExposure)} /><Kpi label="Check" value={check} tone="#0056B0" /><Kpi label="Pending" value={pending} tone="#B54708" />
    </Box>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '4fr 8fr' }, gap: 3, mt: 3 }}>
      <Stack spacing={3}>
        <Card sx={cardSx}><SectionTitle>Severity 분포</SectionTitle><Stack alignItems="center" sx={{ p: 3 }}>
          <Box sx={{ position: 'relative', width: 192, height: 192 }}><svg width="100%" height="100%" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }} aria-label="Severity 분포 도넛 그래프"><circle cx="18" cy="18" r="16" fill="transparent" stroke="#E8F5E9" strokeWidth="4" /><circle cx="18" cy="18" r="16" fill="transparent" stroke="#F59E0B" strokeWidth="4" strokeDasharray={`${mediumPct} ${ring - mediumPct}`} strokeDashoffset={-lowPct} /><circle cx="18" cy="18" r="16" fill="transparent" stroke="#E53935" strokeWidth="4" strokeDasharray={`${highPct} ${ring - highPct}`} strokeDashoffset={-(lowPct + mediumPct)} /></svg><Stack sx={{ position: 'absolute', inset: 0 }} alignItems="center" justifyContent="center"><Typography color="text.secondary" fontSize={12}>TOTAL</Typography><Typography fontWeight={700} fontSize={24}>{items.length}</Typography></Stack></Box>
          <Stack spacing={1} sx={{ width: '100%', mt: 3 }}><Legend label="High" count={high} total={items.length} color="#E53935" /><Legend label="Medium" count={medium} total={items.length} color="#F59E0B" /><Legend label="Low" count={low} total={items.length} color="#16A34A" /></Stack>
        </Stack></Card>
        <Card sx={cardSx}><SectionTitle>Severity별 노출 금액</SectionTitle><Stack spacing={2.5} sx={{ p: 3 }}><ExposureBar label="High Risk Exposure" amount={highExposure} total={totalExposure} color="#E53935" /><ExposureBar label="Medium Risk Exposure" amount={mediumExposure} total={totalExposure} color="#F59E0B" /><ExposureBar label="Low Risk Exposure" amount={lowExposure} total={totalExposure} color="#16A34A" /></Stack></Card>
      </Stack>
      <Card sx={{ ...cardSx, minWidth: 0 }}><SectionTitle>주요 리스크 Top 5</SectionTitle><Box sx={{ overflowX: 'auto' }}><Box component="table" sx={{ width: '100%', minWidth: 740, borderCollapse: 'collapse', tableLayout: 'fixed' }}><Box component="thead" sx={{ bgcolor: '#F8FAFC' }}><Box component="tr"><Head width="17%">리스크 ID</Head><Head width="34%">제목</Head><Head width="16%" align="right">노출금액</Head><Head width="13%" align="center">Severity</Head><Head width="20%">이관일</Head></Box></Box><Box component="tbody">{latest.length ? latest.map((item) => <Box component="tr" key={item.risk_code} sx={{ borderTop: '1px solid #E5E7EB', '&:hover': { bgcolor: '#F8FAFC' } }}><Cell><Typography component={Link} to={`/risk-reviews/${encodeURIComponent(item.risk_code)}`} sx={{ color: '#0056B0', fontWeight: 700, textDecoration: 'none' }}>{item.risk_code}</Typography></Cell><Cell sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</Cell><Cell align="right" sx={{ fontWeight: 700 }}>{formatAmount(item.exposure_amount || 0)}</Cell><Cell align="center"><Chip size="small" label={item.severity} color={severityColor[item.severity]} /></Cell><Cell sx={{ color: '#667085', fontSize: 12 }}>{formatDate(item.transferred_at)}</Cell></Box>) : <Box component="tr"><Cell colSpan={5} sx={{ py: 5, textAlign: 'center', color: '#667085' }}>이관된 리스크 검토가 없습니다.</Cell></Box>}</Box></Box></Box><Divider /><Box sx={{ p: 2, textAlign: 'center' }}><Typography component={Link} to="/events" color="primary" fontWeight={700} sx={{ textDecoration: 'none' }}>전체 리스크 목록</Typography></Box></Card>
    </Box>
  </Box>
}
function Head({ children, width, align = 'left' }: { children: React.ReactNode; width: string; align?: 'left' | 'center' | 'right' }) { return <Box component="th" sx={{ width, px: 2.5, py: 1.5, color: '#667085', fontSize: 12, textAlign: align }}>{children}</Box> }
function Cell({ children, align = 'left', colSpan, sx = {} }: { children: React.ReactNode; align?: 'left' | 'center' | 'right'; colSpan?: number; sx?: object }) { return <Box component="td" colSpan={colSpan} sx={{ px: 2.5, py: 2, fontSize: 14, textAlign: align, ...sx }}>{children}</Box> }
