import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'
import {
  Add,
  AutoAwesome,
  CalendarMonthOutlined,
  ChevronRight,
  FilterList,
  InfoOutlined,
  MoreVert,
  TrendingUp,
  WarningAmberOutlined,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { api, Company } from '../api'

type DashboardData = {
  dataAsOf?: string
  totalRisks?: number
  highRisks?: number
  openRisks?: number
  events?: number
}

type Severity = 'High' | 'Medium' | 'Low'

const topRisks: Array<{
  id: string
  title: string
  score: number
  exposure: string
  severity: Severity
  issues: number
  owner: string
  reviewDate: string
}> = [
  { id: 'RISK-2507-001', title: '무형자산 취득 적정성 (개발비)', score: 85, exposure: '1.53억', severity: 'High', issues: 3, owner: '김회계', reviewDate: '2025-07-15' },
  { id: 'RISK-2507-002', title: '충당부채 설정 및 반영', score: 72, exposure: '4.2억', severity: 'Medium', issues: 1, owner: '이감사', reviewDate: '2025-07-16' },
  { id: 'RISK-2507-003', title: '수익인식(IFRS 15) 검토', score: 68, exposure: '8.9억', severity: 'Medium', issues: 0, owner: '박회계', reviewDate: '2025-07-14' },
  { id: 'RISK-2507-004', title: '해외 자회사 내부거래 제거', score: 65, exposure: '12.5억', severity: 'Medium', issues: 2, owner: '최관리', reviewDate: '2025-07-17' },
  { id: 'RISK-2507-005', title: '재고자산 평가 손실 반영', score: 45, exposure: '0.8억', severity: 'Low', issues: 0, owner: '정결산', reviewDate: '2025-07-12' },
]

const cardSx = {
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  bgcolor: '#FFFFFF',
  boxShadow: '0 1px 2px rgba(16, 24, 40, 0.06)',
}

const severityStyles: Record<Severity, { color: string; background: string }> = {
  High: { color: '#E53935', background: '#FFEBEE' },
  Medium: { color: '#F59E0B', background: '#FFF8E1' },
  Low: { color: '#16A34A', background: '#E8F5E9' },
}

export function DashboardPage() {
  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get<Company[]>('/companies')).data,
  })
  const company = companies.data?.[0]
  const dashboard = useQuery({
    queryKey: ['dashboard', company?.id],
    enabled: Boolean(company),
    queryFn: async () => (await api.get<DashboardData>('/dashboard', { params: { company_id: company!.id } })).data,
  })

  if (!companies.isPending && !company) {
    return <Alert severity="info">먼저 설정에서 회사와 회계연도 정보를 등록해주세요.</Alert>
  }

  const data = dashboard.data ?? {}
  const totalRisks = data.totalRisks ?? 143
  const highRisks = data.highRisks ?? 12
  const openRisks = data.openRisks ?? 27
  const dataAsOf = data.dataAsOf && /^\d{4}-\d{2}-\d{2}$/.test(data.dataAsOf) ? data.dataAsOf : '2025-07-18'

  return (
    <Box sx={{ position: 'relative', width: '100%', pb: 1, color: '#101828' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'flex-end' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography sx={{ color: '#101828', fontSize: 28, lineHeight: 1.3, fontWeight: 700, letterSpacing: '-0.02em' }}>
            대시보드 (팀장/총괄)
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<CalendarMonthOutlined sx={{ color: '#0056B0' }} />}
              endIcon={<Box component="span" sx={{ color: '#667085', fontSize: 18, lineHeight: 1 }}>⌄</Box>}
              sx={{
                height: 42,
                px: 1.5,
                borderRadius: '8px',
                borderColor: '#E5E7EB',
                bgcolor: '#FFFFFF',
                color: '#101828',
                fontSize: 14,
                fontWeight: 500,
                boxShadow: '0 1px 2px rgba(16, 24, 40, 0.06)',
                '&:hover': { borderColor: '#E5E7EB', bgcolor: '#F8FAFC' },
              }}
            >
              2025년 7월 결산기준
            </Button>
            <IconButton
              aria-label="필터"
              sx={{ width: 42, height: 42, border: '1px solid #E5E7EB', borderRadius: '8px', bgcolor: '#FFFFFF', color: '#667085', boxShadow: '0 1px 2px rgba(16, 24, 40, 0.06)' }}
            >
              <FilterList fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            border: '1px solid #E5E7EB',
            borderRadius: '999px',
            bgcolor: '#F2F4F6',
            color: '#667085',
            fontSize: 14,
            whiteSpace: 'nowrap',
          }}
        >
          데이터 기준일: <Box component="span" sx={{ color: '#101828', fontWeight: 700 }}>{dataAsOf}</Box>
        </Box>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' }, gap: 2, mt: 3 }}>
        <KpiPanel label="전체 리스크">
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <KpiValue>{totalRisks}</KpiValue>
            <Stack direction="row" alignItems="center" spacing={0.25} sx={{ color: '#16A34A' }}>
              <TrendingUp sx={{ fontSize: 15 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>+5.2%</Typography>
            </Stack>
          </Stack>
        </KpiPanel>
        <KpiPanel label="High 리스크">
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <KpiValue color="#E53935">{highRisks}</KpiValue>
            <Chip label="CRITICAL" size="small" sx={{ height: 22, bgcolor: '#FFEBEE', color: '#C62828', fontSize: 11, fontWeight: 700, '& .MuiChip-label': { px: 1.25 } }} />
          </Stack>
        </KpiPanel>
        <KpiPanel label="리스크 노출금액">
          <Stack direction="row" alignItems="baseline" spacing={0.5}>
            <KpiValue>620</KpiValue>
            <Typography sx={{ color: '#667085', fontSize: 14, fontWeight: 700 }}>억원</Typography>
          </Stack>
        </KpiPanel>
        <KpiPanel label="미조치 리스크">
          <KpiValue>{openRisks}</KpiValue>
        </KpiPanel>
        <KpiPanel label="기한 초과 이슈">
          <Stack direction="row" alignItems="center" spacing={1}>
            <KpiValue color="#F59E0B">8</KpiValue>
            <WarningAmberOutlined sx={{ color: '#F59E0B', fontSize: 25 }} />
          </Stack>
        </KpiPanel>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '4fr 8fr' }, gap: 3, mt: 3 }}>
        <Stack spacing={3}>
          <Card sx={{ ...cardSx, overflow: 'hidden' }}>
            <SectionHeading title="Severity 분포" action={<IconButton size="small" aria-label="더보기" sx={{ color: '#667085' }}><MoreVert fontSize="small" /></IconButton>} />
            <Stack alignItems="center" sx={{ p: 3 }}>
              <Box sx={{ position: 'relative', width: 192, height: 192 }}>
                <svg width="100%" height="100%" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }} aria-label="Severity 분포 차트">
                  <circle cx="18" cy="18" r="16" fill="transparent" stroke="#E8F5E9" strokeWidth="4" />
                  <circle cx="18" cy="18" r="16" fill="transparent" stroke="#F59E0B" strokeWidth="4" strokeDasharray="70 100" />
                  <circle cx="18" cy="18" r="16" fill="transparent" stroke="#E53935" strokeWidth="4" strokeDasharray="15 100" strokeDashoffset="-70" />
                </svg>
                <Stack sx={{ position: 'absolute', inset: 0 }} alignItems="center" justifyContent="center">
                  <Typography sx={{ color: '#667085', fontSize: 12, textTransform: 'uppercase' }}>Total</Typography>
                  <Typography sx={{ color: '#101828', fontSize: 24, lineHeight: 1.25, fontWeight: 700 }}>{totalRisks}</Typography>
                </Stack>
              </Box>
              <Stack spacing={1} sx={{ width: '100%', mt: 3 }}>
                <LegendRow color="#E53935" label="High" value={`${highRisks}건 (8.4%)`} />
                <LegendRow color="#F59E0B" label="Medium" value="88건 (61.5%)" />
                <LegendRow color="#16A34A" label="Low" value="43건 (30.1%)" />
              </Stack>
            </Stack>
          </Card>

          <Card sx={{ ...cardSx, overflow: 'hidden' }}>
            <SectionHeading title="Severity별 노출 금액" />
            <Stack spacing={2.5} sx={{ p: 3 }}>
              <ExposureBar label="High Risk Exposure" value="156억원" percentage={25} color="#E53935" />
              <ExposureBar label="Medium Risk Exposure" value="384억원" percentage={62} color="#F59E0B" />
              <ExposureBar label="Low Risk Exposure" value="80억원" percentage={13} color="#16A34A" />
            </Stack>
          </Card>
        </Stack>

        <Card sx={{ ...cardSx, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <SectionHeading
            title="주요 리스크 Top 5"
            action={(
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" size="small" sx={tableButtonSx}>필터</Button>
                <Button variant="outlined" size="small" sx={tableButtonSx}>엑셀 다운로드</Button>
              </Stack>
            )}
          />
          <Box sx={{ flex: 1, overflowX: 'auto' }}>
            <Box component="table" sx={{ width: '100%', minWidth: 810, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <Box component="thead" sx={{ bgcolor: '#F8FAFC' }}>
                <Box component="tr" sx={{ borderBottom: '1px solid #E5E7EB' }}>
                  <TableHead width="13%">리스크 ID</TableHead>
                  <TableHead width="31%">제목</TableHead>
                  <TableHead width="9%" align="center">스코어</TableHead>
                  <TableHead width="11%" align="right">노출금액</TableHead>
                  <TableHead width="12%" align="center">Severity</TableHead>
                  <TableHead width="10%" align="center">오픈 이슈</TableHead>
                  <TableHead width="7%">담당자</TableHead>
                  <TableHead width="12%">리뷰일</TableHead>
                </Box>
              </Box>
              <Box component="tbody">
                {topRisks.map((risk) => (
                  <Box component="tr" key={risk.id} sx={{ borderBottom: '1px solid #E5E7EB', '&:hover': { bgcolor: '#F8FAFC' } }}>
                    <TableCell sx={{ color: '#0056B0', fontWeight: 500 }}>{risk.id}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}><Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{risk.title}</Box></TableCell>
                    <TableCell align="center">
                      {risk.score === 85 ? <Box component="span" sx={{ display: 'inline-block', minWidth: 32, py: 0.25, borderRadius: '4px', bgcolor: '#FFEBEE', color: '#C62828', fontSize: 11, fontWeight: 700 }}>{risk.score}</Box> : <Box component="span" sx={{ fontWeight: 700 }}>{risk.score}</Box>}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{risk.exposure}</TableCell>
                    <TableCell align="center"><SeverityBadge severity={risk.severity} /></TableCell>
                    <TableCell align="center" sx={{ color: risk.issues === 3 ? '#E53935' : risk.issues === 0 ? '#667085' : '#101828', fontWeight: risk.issues === 3 ? 700 : 400 }}>{risk.issues}</TableCell>
                    <TableCell>{risk.owner}</TableCell>
                    <TableCell sx={{ color: '#667085', fontSize: 12 }}>{risk.reviewDate}</TableCell>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
          <Box sx={{ p: 2, borderTop: '1px solid #E5E7EB', textAlign: 'center' }}>
            <Button endIcon={<ChevronRight sx={{ fontSize: '16px !important' }} />} sx={{ color: '#0056B0', fontSize: 14, fontWeight: 700 }}>
              전체 리스크 목록
            </Button>
          </Box>
        </Card>
      </Box>

      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          mt: 3,
          p: 2.5,
          border: '1px solid rgba(0, 86, 176, 0.2)',
          borderRadius: '12px',
          bgcolor: 'rgba(0, 86, 176, 0.05)',
        }}
      >
        <Box sx={{ position: 'absolute', right: -16, top: -28, color: '#0056B0', opacity: 0.08 }}>
          <BarChartWatermark />
        </Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ position: 'relative', zIndex: 1, mb: 1.5 }}>
          <AutoAwesome sx={{ color: '#0056B0', fontSize: 21 }} />
          <Typography sx={{ color: '#0056B0', fontSize: 16, fontWeight: 700 }}>AI 분석 요약</Typography>
          <Chip label="BETA" size="small" sx={{ height: 20, ml: '4px !important', borderRadius: '4px', bgcolor: '#0056B0', color: '#FFFFFF', fontSize: 10, '& .MuiChip-label': { px: 0.75 } }} />
        </Stack>
        <Typography sx={{ position: 'relative', zIndex: 1, maxWidth: 1100, color: '#3C5482', fontSize: 14, lineHeight: 1.8 }}>
          현재 2025년 7월 결산 기준, <Box component="strong" sx={{ color: '#0056B0' }}>무형자산(개발비) 적정성 리스크</Box>가 가장 높은 스코어(85)를 기록하고 있으며 3건의 미해결 이슈가 존재합니다. 전월 대비 High Severity 비중이 2% 소폭 상승하였으나, 전체 노출 금액은 해외 자회사 내부거래 정산으로 인해 전월비 약 12% 감소 추세에 있습니다. 미조치 이슈 중 8건이 기한을 초과하였으므로 담당자별 조치 이행 현황 점검이 권고됩니다.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ position: 'relative', zIndex: 1, mt: 2, pt: 1.5, borderTop: '1px solid rgba(0, 86, 176, 0.1)', color: '#667085' }}>
          <Typography sx={{ fontSize: 11 }}>최근 분석 시점: {dataAsOf} 09:15</Typography>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <InfoOutlined sx={{ fontSize: 13 }} />
            <Typography sx={{ fontSize: 11, fontStyle: 'italic' }}>AI에 의해 생성된 요약 정보입니다. 최종 판단은 담당자의 검토가 필요합니다.</Typography>
          </Stack>
        </Stack>
      </Box>

      <Typography sx={{ mt: 4, mb: 1, color: 'rgba(102, 112, 133, 0.6)', fontSize: 10, textAlign: 'right', textTransform: 'uppercase' }}>
        ARIP Audit Risk Intelligence Platform v2.4.0-Stable | Built for Professional Auditors
      </Typography>

      <IconButton
        aria-label="새 리스크 생성"
        sx={{
          position: 'fixed',
          right: 32,
          bottom: 32,
          zIndex: 20,
          width: 56,
          height: 56,
          bgcolor: '#0056B0',
          color: '#FFFFFF',
          boxShadow: '0 16px 32px rgba(16, 24, 40, 0.25)',
          '&:hover': { bgcolor: '#004A98' },
        }}
      >
        <Add />
      </IconButton>
    </Box>
  )
}

function KpiPanel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card sx={{ ...cardSx, minHeight: 118, p: 2.5 }}>
      <Typography sx={{ color: '#667085', fontSize: 14, mb: 1 }}>{label}</Typography>
      {children}
    </Card>
  )
}

function KpiValue({ children, color = '#101828' }: { children: React.ReactNode; color?: string }) {
  return <Typography component="span" sx={{ color, fontFamily: '"Hanken Grotesk", "Noto Sans KR", sans-serif', fontSize: 27, lineHeight: 1.2, fontWeight: 600 }}>{children}</Typography>
}

function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minHeight: 57, px: 2.5, py: 2, borderBottom: '1px solid #E5E7EB' }}>
      <Typography sx={{ color: '#101828', fontSize: 18, lineHeight: 1.35, fontWeight: 500 }}>{title}</Typography>
      {action}
    </Stack>
  )
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between">
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
        <Typography sx={{ fontSize: 14 }}>{label}</Typography>
      </Stack>
      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{value}</Typography>
    </Stack>
  )
}

function ExposureBar({ label, value, percentage, color }: { label: string; value: string; percentage: number; color: string }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography sx={{ color: '#667085', fontSize: 12 }}>{label}</Typography>
        <Typography sx={{ color: '#101828', fontSize: 12, fontWeight: 700 }}>{value}</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={percentage} sx={{ height: 8, borderRadius: '999px', bgcolor: '#F2F4F6', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: '999px' } }} />
    </Box>
  )
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const style = severityStyles[severity]
  return <Box component="span" sx={{ display: 'inline-block', px: 1.25, py: 0.25, borderRadius: '999px', color: style.color, bgcolor: style.background, fontSize: 11, fontWeight: 700 }}>{severity}</Box>
}

function TableHead({ children, width, align = 'left' }: { children: React.ReactNode; width?: string; align?: 'left' | 'center' | 'right' }) {
  return <Box component="th" sx={{ width, px: 2.5, py: 1.5, color: '#667085', fontSize: 12, lineHeight: 1.35, fontWeight: 600, textAlign: align }}>{children}</Box>
}

function TableCell({ children, align = 'left', sx = {} }: { children: React.ReactNode; align?: 'left' | 'center' | 'right'; sx?: object }) {
  return <Box component="td" sx={{ px: 2.5, py: 2, color: '#101828', fontSize: 14, lineHeight: 1.45, textAlign: align, ...sx }}>{children}</Box>
}

function BarChartWatermark() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="8" aria-hidden="true">
      <path d="M18 98h84V18" />
      <path d="M31 84V62h14v22M55 84V45h14v39M79 84V29h14v55" />
    </svg>
  )
}

const tableButtonSx = {
  minWidth: 0,
  px: 1.5,
  py: 0.5,
  borderRadius: '4px',
  borderColor: '#E5E7EB',
  color: '#101828',
  fontSize: 12,
  fontWeight: 500,
  '&:hover': { borderColor: '#E5E7EB', bgcolor: '#F2F4F6' },
}
