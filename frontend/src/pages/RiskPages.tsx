import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api, Company, Risk } from '../api'

const border = '#E5E7EB'
const surface = '#F2F4F6'
const primary = '#0056B0'
const cardSx = { borderColor: border, borderRadius: '12px', boxShadow: '0 1px 2px rgba(16,24,40,.04)' }
const labelSx = { color: '#667085', fontSize: 11, fontWeight: 700, letterSpacing: '.03em' }

type RiskDetail = Risk & {
  memory: unknown[]
  crossFindings: Array<{ id: string; title: string; statement: string; finding_type: string }>
  exposure?: number | string
  updated_at?: string
  owner?: string
}

const levelMeta: Record<string, { color: string; bg: string; border: string }> = {
  HIGH: { color: '#E53935', bg: '#FDECEC', border: '#F7CACA' },
  CRITICAL: { color: '#B42318', bg: '#FEE4E2', border: '#FDA29B' },
  MEDIUM: { color: '#D58B00', bg: '#FFF6E5', border: '#F8E2B8' },
  LOW: { color: '#0066A4', bg: '#EAF4FB', border: '#BED7E7' },
}

function SeverityPill({ value }: { value: string }) {
  const normalized = value?.toUpperCase() || 'LOW'
  const meta = levelMeta[normalized] ?? levelMeta.LOW
  const label = normalized.charAt(0) + normalized.slice(1).toLowerCase()
  return <Chip label={label} size="small" sx={{ height: 26, borderRadius: '5px', color: meta.color, bgcolor: meta.bg, border: `1px solid ${meta.border}`, fontWeight: 700, fontSize: 12 }} />
}

function StatusDot({ value }: { value: string }) {
  const normalized = value?.toUpperCase() || 'OPEN'
  const color = normalized.includes('RESOLVED') ? '#64748B' : normalized.includes('EVIDENCE') || normalized.includes('ACCEPTED') ? '#13A863' : normalized.includes('REVIEW') ? '#0067B9' : '#F59E0B'
  const label: Record<string, string> = { OPEN: 'Open', REVIEW: 'Review', IN_REVIEW: 'Review', EVIDENCE_ATTACHED: 'Evidence Attached', RESOLVED: 'Resolved', ACCEPTED: 'Accepted' }
  return <Stack direction="row" alignItems="center" spacing={1}><Box sx={{ width: 8, height: 8, bgcolor: color, borderRadius: '50%', flex: '0 0 auto' }} /><Typography sx={{ fontSize: 14, lineHeight: 1.25 }}>{label[normalized] ?? value}</Typography></Stack>
}

function SectionTitle({ icon, children, action }: { icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pb: 1.5, borderBottom: `1px solid ${border}` }}><Stack direction="row" spacing={1} alignItems="center">{icon}<Typography sx={{ fontSize: 18, fontWeight: 700 }}>{children}</Typography></Stack>{action}</Stack>
}

function EmptyList({ text = '등록된 내용이 없습니다.' }: { text?: string }) {
  return <Typography sx={{ color: 'text.secondary', fontSize: 14, py: 1 }}>{text}</Typography>
}

export function RiskListPage() {
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<Company[]>('/companies')).data })
  const company = companies?.[0]
  const { data = [], isLoading } = useQuery({
    queryKey: ['risks', company?.id], enabled: Boolean(company),
    queryFn: async () => (await api.get<Risk[]>('/risks', { params: { company_id: company!.id } })).data,
  })

  return <Box>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-end' }} spacing={2} sx={{ mb: 3 }}>
      <Box><Typography sx={{ color: 'text.secondary', fontSize: 12, mb: 1 }}>홈 <ChevronRightRoundedIcon sx={{ fontSize: 14, verticalAlign: 'middle', mx: .5 }} /> <Box component="span" sx={{ color: primary }}>리스크 관리</Box></Typography><Typography variant="h4">리스크 관리</Typography></Box>
      <Stack direction="row" spacing={1.5}><Button variant="outlined" startIcon={<DownloadRoundedIcon />} sx={{ color: 'text.primary', borderColor: border, bgcolor: '#fff', px: 2 }}>엑셀 다운로드</Button><Button variant="contained" startIcon={<AddRoundedIcon />} sx={{ bgcolor: primary, px: 2.25 }}>새 리스크 등록</Button></Stack>
    </Stack>

    <Card sx={{ ...cardSx, mb: 3 }}><CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', xl: '175px 200px 235px 185px minmax(260px,1fr)' }, gap: 2, alignItems: 'end' }}>
        <Box><Typography sx={{ ...labelSx, mb: .75 }}>결산기간</Typography><TextField fullWidth size="small" value="2025-07" slotProps={{ input: { readOnly: true, startAdornment: <InputAdornment position="start"><CalendarTodayOutlinedIcon sx={{ fontSize: 19, color: 'text.secondary' }} /></InputAdornment> } }} sx={{ '& .MuiOutlinedInput-root': { bgcolor: surface } }} /></Box>
        <Box><Typography sx={{ ...labelSx, mb: .75 }}>리스크 유형</Typography><FormControl fullWidth size="small"><Select value="all" sx={{ bgcolor: surface }}><MenuItem value="all">전체 유형</MenuItem></Select></FormControl></Box>
        <Box><Typography sx={{ ...labelSx, mb: .75 }}>Severity</Typography><Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', p: .5, height: 40, boxSizing: 'border-box', border: `1px solid ${border}`, borderRadius: 1, bgcolor: surface }}><Button size="small" sx={{ minWidth: 0, color: '#E53935', bgcolor: '#fff', border: '1px solid #F7CACA', boxShadow: '0 1px 2px rgba(0,0,0,.05)', fontSize: 12, fontWeight: 700 }}>High</Button><Button size="small" sx={{ minWidth: 0, color: 'text.secondary', fontSize: 12, fontWeight: 700 }}>Medium</Button><Button size="small" sx={{ minWidth: 0, color: 'text.secondary', fontSize: 12, fontWeight: 700 }}>Low</Button></Box></Box>
        <Box><Typography sx={{ ...labelSx, mb: .75 }}>상태</Typography><FormControl fullWidth size="small"><Select value="all" sx={{ bgcolor: surface }}><MenuItem value="all">전체 상태</MenuItem></Select></FormControl></Box>
        <Box><Typography sx={{ ...labelSx, mb: .75 }}>검색</Typography><TextField fullWidth size="small" placeholder="리스크 ID, 제목 검색" slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: 'text.secondary' }} /></InputAdornment> } }} sx={{ '& .MuiOutlinedInput-root': { bgcolor: surface } }} /></Box>
      </Box>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mt: 2.5, pl: 1, borderLeft: `1px solid ${border}` }}><Box sx={{ textAlign: 'right', minWidth: 94 }}><Typography sx={labelSx}>전체 결과</Typography><Typography component="span" sx={{ color: primary, fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{data.length}</Typography><Typography component="span" sx={{ color: 'text.secondary', ml: .5, fontSize: 13 }}>건</Typography></Box><IconButton sx={{ border: `1px solid ${border}`, borderRadius: 1.5 }}><RefreshRoundedIcon sx={{ color: 'text.secondary' }} /></IconButton></Stack>
    </CardContent></Card>

    <Card sx={{ ...cardSx, overflow: 'hidden' }}><Box sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 1050 }}>
      <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}><TableCell padding="checkbox"><Checkbox size="small" /></TableCell><TableCell>RISK ID</TableCell><TableCell>제목</TableCell><TableCell>EXPOSURE</TableCell><TableCell>SEVERITY</TableCell><TableCell>STATUS</TableCell><TableCell>담당자</TableCell><TableCell align="center">최근 업데이트</TableCell><TableCell width={48} /></TableRow></TableHead>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={9} align="center" sx={{ py: 8 }}><CircularProgress size={28} /></TableCell></TableRow> : data.length === 0 ? <TableRow><TableCell colSpan={9} align="center" sx={{ py: 7, color: 'text.secondary' }}>표시할 리스크가 없습니다.</TableCell></TableRow> : data.map((risk, index) => {
        const detail = risk as Risk & { exposure?: number | string; owner?: string; updated_at?: string }
        const owner = detail.owner ?? ['김회계', '이감사', '박회계', '최관리'][index % 4]
        const initials = owner.slice(0, 2)
        return <TableRow key={risk.id} hover sx={{ '& td': { py: 1.65 } }}><TableCell padding="checkbox"><Checkbox size="small" /></TableCell><TableCell><Typography component={Link} to={`/risks/${risk.id}`} sx={{ color: primary, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>{risk.id}</Typography></TableCell><TableCell sx={{ minWidth: 240, fontWeight: 500 }}>{risk.title}</TableCell><TableCell sx={{ whiteSpace: 'nowrap' }}>{detail.exposure != null ? Number(detail.exposure).toLocaleString() : Number(risk.score).toLocaleString()}</TableCell><TableCell><SeverityPill value={risk.level} /></TableCell><TableCell><StatusDot value={risk.status} /></TableCell><TableCell><Stack direction="row" alignItems="center" spacing={1}><Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: index % 2 ? '#EADDFF' : '#C7DBFA', color: primary, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700 }}>{initials}</Box><Typography fontSize={14}>{owner}</Typography></Stack></TableCell><TableCell align="center" sx={{ color: 'text.secondary', fontSize: 12 }}>{detail.updated_at?.slice(0, 10) ?? `2025-07-${String(18 - index).padStart(2, '0')}`}</TableCell><TableCell><IconButton size="small"><MoreVertRoundedIcon sx={{ color: 'text.secondary' }} /></IconButton></TableCell></TableRow>
      })}</TableBody>
    </Table></Box><Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" spacing={2} sx={{ px: 2.5, py: 2 }}><Typography color="text.secondary" fontSize={13}>보여지는 결과: <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>{data.length}</Box> / {data.length}건</Typography><Stack direction="row" spacing={.75} alignItems="center"><Button variant="contained" size="small" sx={{ minWidth: 38, bgcolor: primary }}>1</Button><Button size="small" sx={{ minWidth: 38, color: 'text.secondary' }}>2</Button><Button size="small" sx={{ minWidth: 38, color: 'text.secondary' }}>3</Button></Stack><Typography color="text.secondary" fontSize={13}>페이지당 표시: <Chip label="10건씩 보기" size="small" sx={{ ml: 1 }} /></Typography></Stack></Card>

    <Alert icon={<AutoAwesomeRoundedIcon />} severity="info" variant="outlined" sx={{ mt: 3, borderColor: '#BED7E7', bgcolor: '#F4F8FB', alignItems: 'center' }}><Typography component="span" fontWeight={700} color={primary} sx={{ mr: 1 }}>AI 분석 요약</Typography>AI 분석 결과는 검토 우선순위를 제안합니다. 최종 판단과 조치는 담당자가 원장·증빙·회계기준을 확인한 뒤 확정해야 합니다.</Alert>
  </Box>
}

function RiskOverviewCard({ risk }: { risk: RiskDetail }) {
  const exposure = risk.exposure != null ? Number(risk.exposure).toLocaleString() : Number(risk.score).toLocaleString()
  return <Card sx={cardSx}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}><SectionTitle icon={<InfoOutlinedIcon sx={{ color: primary }} />}>기본 정보</SectionTitle><Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 2.5, mt: 6 }}><Box><Typography sx={labelSx}>관련 계정</Typography><Typography sx={{ mt: .5, fontWeight: 700 }}>무형자산 / 개발비</Typography></Box><Box><Typography sx={labelSx}>거래 기간</Typography><Typography sx={{ mt: .5, fontWeight: 700 }}>2025-07</Typography></Box><Box><Typography sx={labelSx}>EXPOSURE (추정)</Typography><Typography sx={{ mt: .5, color: primary, fontWeight: 700 }}>{exposure}원</Typography></Box><Box><Typography sx={labelSx}>상태 / 담당자</Typography><StatusDot value={risk.status} /></Box></Box></CardContent></Card>
}

function RiskScoreCard({ risk }: { risk: RiskDetail }) {
  const score = Math.min(100, Math.max(0, Number(risk.score) || 0))
  return <Card sx={cardSx}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}><SectionTitle icon={<AnalyticsOutlinedIcon sx={{ color: primary }} />}>리스크 요약</SectionTitle><Stack direction="row" spacing={2.5} alignItems="center" sx={{ mt: 2 }}><Box sx={{ width: 112, height: 112, borderRadius: '50%', background: `conic-gradient(#E53935 0 ${score}%, #EEF1F5 ${score}% 100%)`, display: 'grid', placeItems: 'center', flex: '0 0 auto' }}><Box sx={{ width: 82, height: 82, borderRadius: '50%', bgcolor: '#fff', display: 'grid', placeItems: 'center' }}><Typography sx={{ fontWeight: 700, fontSize: 24 }}>{score}</Typography></Box></Box><Box sx={{ minWidth: 0 }}><Typography sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.65 }} noWrap={false}>{risk.package?.summary || risk.statement}</Typography><Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>{[['Impact','High'],['Prob.','Mid'],['Control','Low']].map(([label,value]) => <Box key={label} sx={{ bgcolor: surface, borderRadius: 1, p: 1, minWidth: 52, textAlign: 'center' }}><Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{label}</Typography><Typography sx={{ fontSize: 12, fontWeight: 700 }}>{value}</Typography></Box>)}</Stack></Box></Stack></CardContent></Card>
}

function EvidenceRecommendation({ items }: { items?: string[] }) {
  return <Card sx={{ ...cardSx, bgcolor: '#2D3133', color: '#fff', borderColor: '#2D3133' }}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}><Stack direction="row" spacing={1} alignItems="center"><AutoAwesomeRoundedIcon sx={{ color: '#A9C7FF' }} /><Typography fontWeight={700}>지능형 증빙 추천</Typography></Stack><Typography sx={{ mt: 2, fontSize: 14, lineHeight: 1.7 }}>현재 이슈를 해결하기 위해 유사 사례에서 사용된 핵심 증빙을 추천합니다. 추천 결과도 담당자의 확인이 필요합니다.</Typography><Stack spacing={1} sx={{ mt: 2 }}>{(items?.length ? items.slice(0, 3) : ['기술성 평가 보고서.pdf', '프로젝트 관리 일지.xlsx']).map((item) => <Stack key={item} direction="row" justifyContent="space-between" sx={{ px: 1.25, py: 1, borderRadius: 1, bgcolor: 'rgba(255,255,255,.1)' }}><Typography fontSize={12}>{item}</Typography><DownloadRoundedIcon sx={{ fontSize: 16 }} /></Stack>)}</Stack></CardContent></Card>
}

export function RiskDetailPage() {
  const { riskId } = useParams()
  const { data: risk } = useQuery({ queryKey: ['risk', riskId], enabled: Boolean(riskId), queryFn: async () => (await api.get<RiskDetail>(`/risks/${riskId}`)).data })
  if (!risk) return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress size={30} /><Typography sx={{ mt: 2, color: 'text.secondary' }}>리스크 정보를 불러오는 중입니다.</Typography></Box>
  const pkg = risk.package
  const references = pkg?.references ?? []

  return <Box>
    <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}><Box><Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}><Chip label={risk.id} size="small" sx={{ color: primary, bgcolor: '#EAF4FB', borderRadius: 1, fontWeight: 700 }} /><SeverityPill value={risk.level} /></Stack><Typography variant="h4">{risk.title}</Typography></Box><Stack direction="row" spacing={1.25} alignSelf={{ lg: 'flex-end' }} flexWrap="wrap" useFlexGap><Button variant="outlined" startIcon={<EditRoundedIcon />} sx={{ color: 'text.primary', borderColor: border }}>리스크 편집</Button><Button variant="outlined" startIcon={<Inventory2OutlinedIcon />} sx={{ color: 'text.primary', borderColor: border }}>Risk Package 생성</Button><Button variant="contained" startIcon={<CheckCircleOutlineRoundedIcon />} sx={{ bgcolor: primary }}>리뷰 시작</Button></Stack></Stack>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,1fr)', xl: 'repeat(3,1fr)' }, gap: 3 }}><RiskOverviewCard risk={risk} /><RiskScoreCard risk={risk} /><Card sx={{ ...cardSx, bgcolor: '#EEF5FA', borderColor: '#BDD3E4' }}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}><SectionTitle icon={<AutoAwesomeRoundedIcon sx={{ color: primary }} />} action={<Chip label="AI 분석 요약" size="small" sx={{ bgcolor: primary, color: '#fff', fontSize: 10, fontWeight: 700 }} />}>지능형 통찰</SectionTitle><Stack spacing={1.5} sx={{ mt: 1.75 }}>{[pkg?.summary, risk.crossFindings?.[0]?.statement].filter(Boolean).slice(0, 2).map((text, index) => <Stack key={String(text)} direction="row" spacing={1.25}><Typography sx={{ color: primary, fontWeight: 700 }}>{String(index + 1).padStart(2, '0')}</Typography><Typography sx={{ fontSize: 13, lineHeight: 1.55 }}>{text}</Typography></Stack>)}{!pkg?.summary && <EmptyList />}</Stack></CardContent></Card></Box>

    <Tabs value={0} variant="scrollable" scrollButtons={false} sx={{ mt: 3, mb: 3, borderBottom: `1px solid ${border}`, minHeight: 48, '& .MuiTab-root': { minWidth: 100, textTransform: 'none', fontSize: 13 } }}><Tab label="개요" /><Tab label="Accounting Issue" /><Tab label="참조 기준/사례" /><Tab label="예상 감사 질문" /><Tab label="필요 증빙" /><Tab label="대응 방안" /><Tab label="Risk History" /><Tab label="댓글" /><Tab label="타임라인" /></Tabs>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0,8fr) minmax(310px,4fr)' }, gap: 3 }}><Stack spacing={3}>
      <Card sx={cardSx}><CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}><SectionTitle action={<Button size="small" sx={{ fontWeight: 700 }}>작성 가이드</Button>}>회계 이슈 상세 (Accounting Deep Dive)</SectionTitle><Box sx={{ mt: 2.25, borderLeft: `4px solid ${primary}`, pl: 1.5 }}><Typography fontWeight={700}>1. 주요 회계 판단 및 검토 사항</Typography></Box><Typography sx={{ mt: 1.25, color: '#475467', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{risk.statement}</Typography>{risk.crossFindings?.[0] && <><Box sx={{ mt: 2.25, borderLeft: `4px solid ${primary}`, pl: 1.5 }}><Typography fontWeight={700}>2. 교차 분석에서 확인된 위험 신호</Typography></Box><Typography sx={{ mt: 1.25, color: '#475467', lineHeight: 1.85 }}>{risk.crossFindings[0].statement}</Typography></>}<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,1fr)' }, gap: 2, mt: 3 }}><Box sx={{ p: 2, bgcolor: '#F5F6F8', border: `1px solid ${border}`, borderRadius: 1.5 }}><Typography sx={labelSx}>주요 리스크 포인트</Typography>{(pkg?.expected_questions?.length ? pkg.expected_questions : ['거래 실질과 회계처리의 일관성을 확인해야 합니다.']).slice(0, 3).map((item) => <Stack key={item} direction="row" spacing={1} sx={{ mt: 1 }}><WarningAmberRoundedIcon sx={{ color: '#E85D5A', fontSize: 18, mt: .2 }} /><Typography fontSize={13}>{item}</Typography></Stack>)}</Box><Box sx={{ p: 2, bgcolor: '#F3FAF6', border: '1px solid #CAE7D4', borderRadius: 1.5 }}><Typography sx={{ ...labelSx, color: '#168A50' }}>권장 확인 사항</Typography>{(pkg?.response_guidance?.length ? pkg.response_guidance : ['관련 승인자료와 원장 내역을 재확인합니다.']).slice(0, 3).map((item) => <Stack key={item} direction="row" spacing={1} sx={{ mt: 1 }}><CheckCircleOutlineRoundedIcon sx={{ color: '#13A863', fontSize: 18, mt: .2 }} /><Typography fontSize={13}>{item}</Typography></Stack>)}</Box></Box></CardContent></Card>
      <Card sx={cardSx}><CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}><Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 18, fontWeight: 700 }}>Exposure Trend (6개월 추이)</Typography><Typography sx={{ ...labelSx, color: primary }}>● 추정 Exposure</Typography></Stack><Box sx={{ height: 260, mt: 3, display: 'flex', alignItems: 'flex-end', gap: 2 }}>{[42,47,58,68,82,100].map((height,index) => <Box key={index} sx={{ flex: 1, textAlign: 'center' }}><Box sx={{ height: height * 2, maxHeight: 220, bgcolor: index === 5 ? primary : '#F0F2F5', borderRadius: '4px 4px 0 0' }} /> <Typography sx={{ mt: 1, fontSize: 11, color: index === 5 ? primary : 'text.secondary', fontWeight: index === 5 ? 700 : 400 }}>{index + 2}월</Typography></Box>)}</Box></CardContent></Card>
    </Stack><Stack spacing={3}>
      <Card sx={cardSx}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}><SectionTitle>참조 기준 및 사례</SectionTitle><Stack spacing={1.5} sx={{ mt: 2 }}>{references.length ? references.slice(0, 4).map((reference, index) => <Box key={`${reference.type}-${reference.code}-${index}`} sx={{ p: 1.5, bgcolor: '#F5F6F8', borderLeft: `3px solid ${index === 0 ? primary : '#667085'}`, borderRadius: 1 }}><Typography sx={{ color: primary, fontSize: 11, fontWeight: 700 }}>{reference.type ?? '참조 기준'}</Typography><Typography sx={{ mt: .5, fontSize: 13, fontWeight: 700 }}>{reference.code || reference.status || '확인 필요'}</Typography></Box>) : <EmptyList />}</Stack></CardContent></Card>
      <EvidenceRecommendation items={pkg?.evidence_checklist} />
      <Card sx={cardSx}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}><SectionTitle>Activity Timeline</SectionTitle><Stack spacing={2} sx={{ mt: 2 }}>{[['리스크 탐지됨','AI Engine'],['담당자 지정','시스템 자동'],['검토 시작','담당자 확인']].map(([title,detail], index) => <Stack key={title} direction="row" spacing={1.5}><Box sx={{ width: 9, height: 9, mt: .7, borderRadius: '50%', bgcolor: index === 0 ? primary : border, boxShadow: `0 0 0 4px ${index === 0 ? '#EAF4FB' : '#F7F8FA'}` }} /><Box><Typography fontSize={13} fontWeight={700}>{title}</Typography><Typography sx={{ color: 'text.secondary', fontSize: 10 }}>2025-07-{15 + index * 2} · {detail}</Typography></Box></Stack>)}</Stack></CardContent></Card>
      {pkg?.evidence_status === 'EVIDENCE_ENRICHMENT_REQUIRED' && <Alert severity="warning" variant="outlined"><Typography fontWeight={700}>근거 보강 필요</Typography><Typography variant="body2" sx={{ mt: .5 }}>누락 사실과 추천 증빙을 보강한 뒤 최종 검토하세요.</Typography></Alert>}
      {references.some((reference) => reference.status === 'REFERENCE_REQUIRED') && <Alert severity="warning" variant="outlined">확인되지 않은 기준 문단과 연결된 Package는 최종 결론으로 사용할 수 없습니다.</Alert>}
      <Alert severity="info" variant="outlined" sx={{ bgcolor: '#F8FBFF' }}>AI 분석은 검토 보조 정보이며, 사람의 승인 없이 회계 결론이나 조치로 확정되지 않습니다.</Alert>
    </Stack></Box>
  </Box>
}
