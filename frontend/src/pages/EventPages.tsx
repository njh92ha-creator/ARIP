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
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded'
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { AccountingEvent, api, Company, Risk } from '../api'

const border = '#E5E7EB'
const surface = '#F2F4F6'
const primary = '#0056B0'
const cardSx = { borderColor: border, borderRadius: '12px', boxShadow: '0 1px 2px rgba(16,24,40,.04)' }
const labelSx = { color: '#667085', fontSize: 11, fontWeight: 700, letterSpacing: '.03em' }

type RelatedRisk = Partial<Risk> & { id: string; owner?: string }
type JournalLine = { id?: string; document_number?: string; account_name?: string; posting_date?: string; local_amount?: number | string; amount?: number | string }
type EventDetails = AccountingEvent & {
  description?: string
  posting_date?: string
  canonical_signature?: Record<string, unknown>
  journalLines?: JournalLine[]
  risks?: RelatedRisk[]
  relatedRisks?: RelatedRisk[]
}

const severityMeta: Record<string, { color: string; bg: string }> = {
  HIGH: { color: '#E53935', bg: '#FDECEC' }, MEDIUM: { color: '#D58B00', bg: '#FFF6E5' }, LOW: { color: '#168A50', bg: '#ECF8F0' },
}

function Severity({ value = 'LOW' }: { value?: string }) {
  const normalized = value.toUpperCase()
  const meta = severityMeta[normalized] ?? severityMeta.LOW
  return <Chip label={normalized.charAt(0) + normalized.slice(1).toLowerCase()} size="small" sx={{ height: 24, borderRadius: 1, bgcolor: meta.bg, color: meta.color, fontWeight: 700, fontSize: 11 }} />
}

function Status({ value = '-' }: { value?: string }) {
  const normalized = value.toUpperCase()
  const color = normalized.includes('COMPLETE') || normalized.includes('RESOLVED') ? '#13A863' : normalized.includes('REVIEW') || normalized.includes('ANAL') ? '#F59E0B' : '#64748B'
  return <Stack direction="row" spacing={.75} alignItems="center"><Box sx={{ width: 7, height: 7, bgcolor: color, borderRadius: '50%' }} /><Typography fontSize={13}>{value.replaceAll('_', ' ')}</Typography></Stack>
}

function SectionHeader({ children, icon, action }: { children: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode }) {
  return <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pb: 1.5, borderBottom: `1px solid ${border}` }}><Typography sx={{ fontSize: 18, fontWeight: 700 }}>{children}</Typography>{action ?? icon}</Stack>
}

function EventMetric({ label, value, emphasis = false, owner = false }: { label: string; value: React.ReactNode; emphasis?: boolean; owner?: boolean }) {
  return <Box sx={{ p: 2.25, minWidth: 0, minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', borderRight: { md: `1px solid ${border}` }, '&:last-child': { borderRight: 0 } }}><Typography sx={labelSx}>{label}</Typography>{owner ? <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}><Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#D8E2FF', color: primary, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700 }}>김</Box><Typography fontWeight={700}>{value}</Typography></Stack> : <Box sx={{ mt: .8, color: emphasis ? primary : 'text.primary', fontWeight: 700, fontSize: emphasis ? 34 : 15, lineHeight: 1.15 }}>{value}</Box>}</Box>
}

export function EventListPage() {
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<Company[]>('/companies')).data })
  const company = companies?.[0]
  const { data = [], isLoading } = useQuery({ queryKey: ['events', company?.id], enabled: Boolean(company), queryFn: async () => (await api.get<AccountingEvent[]>('/events', { params: { company_id: company!.id } })).data })
  return <Box><Box sx={{ mb: 3 }}><Typography sx={{ color: 'text.secondary', fontSize: 12, mb: 1 }}>홈 · 회계사건(Event)</Typography><Typography variant="h4">회계사건(Event)</Typography><Typography color="text.secondary" sx={{ mt: .75 }}>분류된 회계사건을 검토하고 연결된 리스크와 근거를 확인합니다.</Typography></Box><Card sx={{ ...cardSx, overflow: 'hidden' }}><Box sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 820 }}><TableHead><TableRow><TableCell>이벤트 ID</TableCell><TableCell>제목</TableCell><TableCell>유형</TableCell><TableCell align="right">금액</TableCell><TableCell align="right">분류 신뢰도</TableCell><TableCell>상태</TableCell></TableRow></TableHead><TableBody>{isLoading ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 8 }}><CircularProgress size={28} /></TableCell></TableRow> : data.map((event) => <TableRow key={event.id} hover><TableCell><Typography component={Link} to={`/events/${event.id}`} sx={{ color: primary, fontWeight: 700, textDecoration: 'none' }}>{event.id}</Typography></TableCell><TableCell sx={{ minWidth: 280 }}><Typography component={Link} to={`/events/${event.id}`} sx={{ color: 'text.primary', fontWeight: 600, textDecoration: 'none' }}>{event.title}</Typography></TableCell><TableCell>{event.event_type}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{Number(event.amount).toLocaleString()} {event.currency}</TableCell><TableCell align="right">{Math.round(event.classification_confidence * 100)}%</TableCell><TableCell><Status value={event.status} /></TableCell></TableRow>)}</TableBody></Table></Box><Box sx={{ px: 2.5, py: 1.75, color: 'text.secondary', fontSize: 13 }}>표시 결과: {data.length}건</Box></Card><Alert severity="info" variant="outlined" sx={{ mt: 3, borderColor: '#BFDBFE', bgcolor: '#F8FBFF' }}>이벤트 분류는 검토 보조 정보입니다. 원장, 증빙, 회계기준을 담당자가 확인한 후 후속 조치를 결정하세요.</Alert></Box>
}

function EventOverview({ data, relatedRisks }: { data: EventDetails; relatedRisks: RelatedRisk[] }) {
  return <Card sx={{ ...cardSx, gridColumn: { xl: 'span 4' } }}><CardContent sx={{ p: 2.75, '&:last-child': { pb: 2.75 } }}><SectionHeader icon={<InfoOutlinedIcon sx={{ color: 'text.secondary' }} />}>이벤트 개요</SectionHeader><Typography sx={{ ...labelSx, mt: 2.5 }}>DESCRIPTION</Typography><Typography sx={{ mt: 1, lineHeight: 1.8, fontSize: 14 }}>{data.description ?? data.title}</Typography><Typography sx={{ ...labelSx, mt: 2.5 }}>연결된 리스크 핵심 키워드</Typography><Stack direction="row" flexWrap="wrap" useFlexGap gap={.75} sx={{ mt: 1 }}>{relatedRisks.length ? relatedRisks.slice(0, 4).map((risk) => <Chip key={risk.id} label={risk.title ?? risk.id} size="small" sx={{ maxWidth: 132, bgcolor: '#EAF2FF', color: '#124F9E', border: '1px solid #D2E0F5', borderRadius: 1 }} />) : <Typography color="text.secondary" fontSize={13}>연결된 리스크 정보가 없습니다.</Typography>}</Stack><Box sx={{ mt: 2.5, p: 1.5, borderRadius: 1.5, bgcolor: surface }}><Stack direction="row" spacing={1} alignItems="center"><AutoAwesomeRoundedIcon sx={{ color: primary, fontSize: 19 }} /><Typography fontWeight={700} color={primary} fontSize={13}>AI 분석 요약</Typography></Stack><Typography sx={{ mt: .75, color: '#475467', fontSize: 12, fontStyle: 'italic', lineHeight: 1.65 }}>“분류 결과와 연결 위험은 검토 우선순위를 위한 제안입니다. 정성적 증빙을 보강해 담당자가 최종 판단해야 합니다.”</Typography></Box></CardContent></Card>
}

function AmountTrend() {
  return <Card sx={{ ...cardSx, gridColumn: { xl: 'span 5' } }}><CardContent sx={{ p: 2.75, '&:last-child': { pb: 2.75 }, minHeight: 390, display: 'flex', flexDirection: 'column' }}><SectionHeader action={<Stack direction="row" spacing={1.5}><Typography sx={{ ...labelSx, color: primary }}>● 진행액</Typography><Typography sx={labelSx}>● 예산</Typography></Stack>}>누적 금액 추이</SectionHeader><Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 2, pt: 5 }}>{[38,52,68,100].map((height,index) => <Box key={index} sx={{ flex: 1, textAlign: 'center' }}><Box sx={{ height: height * 2.25, maxHeight: 230, position: 'relative', bgcolor: '#EEF1F5', borderRadius: '4px 4px 0 0', overflow: 'hidden' }}><Box sx={{ position: 'absolute', inset: `${100 - Math.min(92, height)}% 0 0`, bgcolor: primary }} /></Box><Typography sx={{ mt: 1, fontSize: 11, color: index === 3 ? primary : 'text.secondary', fontWeight: index === 3 ? 700 : 400 }}>{index + 4}월</Typography></Box>)}</Box><Stack direction="row" justifyContent="space-between" sx={{ mt: 2, pt: 2, borderTop: `1px solid ${border}` }}><Typography color="text.secondary" fontSize={12}>전월 대비 증감</Typography><Typography color="error.main" fontWeight={700}>↗ +24.8%</Typography></Stack></CardContent></Card>
}

function EventTimeline() {
  const events = [['증빙 서류 업로드','2025-07-20 14:22',primary],['리스크 이상 징후 감지','2025-07-18 09:15','#F59E0B'],['회계 사건 생성','2025-07-15 16:40','#DCE1E7']]
  return <Card sx={{ ...cardSx, gridColumn: { xl: 'span 3' } }}><CardContent sx={{ p: 2.75, '&:last-child': { pb: 2.75 } }}><SectionHeader icon={<HistoryRoundedIcon sx={{ color: 'text.secondary' }} />}>이벤트 타임라인</SectionHeader><Box sx={{ mt: 2.5, position: 'relative', '&::before': { content: '""', position: 'absolute', left: 11, top: 12, bottom: 12, width: 2, bgcolor: border } }}><Stack spacing={3}>{events.map(([title,date,color],index) => <Stack key={title} direction="row" spacing={1.75} sx={{ position: 'relative', opacity: index === 2 ? .6 : 1 }}><Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#fff', border: `2px solid ${color}`, display: 'grid', placeItems: 'center', zIndex: 1, flex: '0 0 auto' }}><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} /></Box><Box><Typography fontSize={13} fontWeight={700}>{title}</Typography><Typography sx={{ color: 'text.secondary', fontSize: 10, mt: .25 }}>{date}</Typography></Box></Stack>)}</Stack></Box></CardContent></Card>
}

function JournalSummary({ lines, amount }: { lines: JournalLine[]; amount: number }) {
  return <Card sx={{ ...cardSx, gridColumn: { xl: 'span 4' } }}><CardContent sx={{ p: 2.75, '&:last-child': { pb: 2.75 } }}><SectionHeader icon={<AnalyticsOutlinedIcon sx={{ color: 'text.secondary' }} />}>전표 요약 (Top 5)</SectionHeader><Stack direction="row" alignItems="center" spacing={2.5} sx={{ my: 2.5 }}><Box sx={{ width: 108, height: 108, borderRadius: '50%', background: 'conic-gradient(#0056B0 0 70%, #475E8D 70% 90%, #B1C9FF 90%)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}><Box sx={{ width: 78, height: 78, borderRadius: '50%', bgcolor: '#fff', display: 'grid', placeItems: 'center' }}><Typography fontSize={13} fontWeight={700}>{amount.toLocaleString()}</Typography></Box></Box><Stack spacing={.6} flex={1}>{[['인건비','70%',primary],['인프라','20%','#475E8D'],['기타','10%','#B1C9FF']].map(([name,pct,color]) => <Stack key={name} direction="row" justifyContent="space-between"><Typography fontSize={12}><Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', bgcolor: color, mr: 1 }} />{name}</Typography><Typography fontSize={12} fontWeight={700}>{pct}</Typography></Stack>)}</Stack></Stack><Stack spacing={1.25}>{lines.length ? lines.slice(0, 3).map((line,index) => <Box key={line.id ?? index} sx={{ p: 1.25, border: `1px solid ${border}`, borderRadius: 1.5 }}><Typography fontSize={12} fontWeight={700} noWrap>{line.document_number ?? line.account_name ?? `전표 ${index + 1}`}</Typography><Typography sx={{ color: 'text.secondary', fontSize: 11 }}>{line.posting_date ?? '-'} | {Number(line.local_amount ?? line.amount ?? 0).toLocaleString()}</Typography></Box>) : <Typography color="text.secondary" fontSize={13}>연결된 전표가 없습니다.</Typography>}</Stack></CardContent></Card>
}

export function EventDetailPage() {
  const { eventId } = useParams()
  const { data } = useQuery({ queryKey: ['event', eventId], enabled: Boolean(eventId), queryFn: async () => (await api.get<EventDetails>(`/events/${eventId}`)).data })
  if (!data) return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress size={30} /><Typography sx={{ mt: 2, color: 'text.secondary' }}>이벤트 정보를 불러오는 중입니다.</Typography></Box>
  const signature = data.canonical_signature ?? {}
  const journalLines = data.journalLines ?? []
  const relatedRisks = data.risks ?? data.relatedRisks ?? []
  const amount = Number(data.amount ?? signature.amount ?? 0)
  const period = String(signature.posting_period ?? signature.posting_date ?? data.posting_date ?? '-').slice(0, 7)
  const account = String(signature.account_name ?? signature.account_code ?? '확인 필요')

  return <Box>
    <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}><Box><Typography sx={{ color: 'text.secondary', fontSize: 12, mb: 1 }}>회계사건(Event) · <Box component="span" sx={{ color: primary }}>이벤트 상세 정보</Box></Typography><Stack direction="row" spacing={1.25} alignItems="center"><Typography variant="h4">{data.id} {data.title}</Typography><Chip label="● 활성" size="small" sx={{ bgcolor: '#E5F7EC', color: '#16A34A', fontWeight: 700 }} /></Stack></Box><Stack direction="row" spacing={1.5} alignSelf={{ lg: 'flex-end' }}><Button variant="outlined" startIcon={<EditRoundedIcon />} sx={{ color: 'text.primary', borderColor: border }}>이벤트 편집</Button><Button variant="contained" startIcon={<AnalyticsOutlinedIcon />} sx={{ bgcolor: primary }}>관련 리스크 보기 ({relatedRisks.length})</Button></Stack></Stack>

    <Card sx={{ ...cardSx, mb: 3, overflow: 'hidden' }}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(3,1fr)', xl: 'repeat(6,1fr)' } }}><EventMetric label="대상 기간" value={period} /><EventMetric label="관련 계정" value={account} /><EventMetric label="리스크 식별" value={`${relatedRisks.length}건`} emphasis /><EventMetric label="누적 발생 금액" value={<>{amount.toLocaleString()}<Typography sx={{ mt: .75, color: 'text.secondary', fontSize: 11, fontWeight: 400 }}>{data.currency ?? 'KRW'}</Typography></>} emphasis /><EventMetric label="생성 일자" value={String(data.posting_date ?? signature.posting_date ?? '2025-07-15').slice(0,10)} /><EventMetric label="담당자" value="김회계" owner /></Box></Card>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(12,minmax(0,1fr))' }, gap: 3 }}><EventOverview data={data} relatedRisks={relatedRisks} /><AmountTrend /><EventTimeline />
      <Card sx={{ ...cardSx, gridColumn: { xl: 'span 8' }, overflow: 'hidden' }}><Box sx={{ px: 2.75, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${border}` }}><Typography sx={{ fontSize: 18, fontWeight: 700 }}>연결된 리스크</Typography><Button size="small" sx={{ fontWeight: 700 }}>전체보기</Button></Box><Box sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 680 }}><TableHead><TableRow><TableCell padding="checkbox"><Checkbox size="small" /></TableCell><TableCell>RISK ID</TableCell><TableCell>TITLE</TableCell><TableCell>SEVERITY</TableCell><TableCell>STATUS</TableCell><TableCell>OWNER</TableCell></TableRow></TableHead><TableBody>{relatedRisks.length ? relatedRisks.slice(0, 5).map((risk,index) => <TableRow key={risk.id}><TableCell padding="checkbox"><Checkbox size="small" /></TableCell><TableCell><Typography component={Link} to={`/risks/${risk.id}`} sx={{ color: primary, textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>{risk.id}</Typography></TableCell><TableCell sx={{ fontSize: 13 }}>{risk.title ?? '-'}</TableCell><TableCell><Severity value={risk.level} /></TableCell><TableCell><Status value={risk.status} /></TableCell><TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{risk.owner ?? ['김회계','이감사','박대리'][index % 3]}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>연결된 리스크 정보가 제공되지 않았습니다.</TableCell></TableRow>}</TableBody></Table></Box></Card>
      <JournalSummary lines={journalLines} amount={amount} />
      <Card sx={{ ...cardSx, gridColumn: { xl: 'span 12' } }}><CardContent sx={{ p: 2.75, '&:last-child': { pb: 2.75 } }}><SectionHeader action={<Button variant="outlined" size="small" startIcon={<UploadFileRoundedIcon />} sx={{ fontWeight: 700 }}>파일 추가</Button>}>첨부 서류 및 증빙</SectionHeader><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', xl: 'repeat(4,1fr)' }, gap: 2, mt: 2.5 }}>{[[<PictureAsPdfOutlinedIcon />,'프로젝트 계획서.pdf','1.4 MB | 2025-07-15','#E53935'],[<InsertDriveFileOutlinedIcon />,'인건비 배부 리스크.xlsx','420 KB | 2025-07-18','#16A34A'],[<ImageOutlinedIcon />,'기술개발 완료 증빙.png','3.8 MB | 2025-07-20',primary]].map(([icon,name,meta,color]) => <Stack key={String(name)} direction="row" spacing={1.5} alignItems="center" sx={{ p: 1.5, border: `1px solid ${border}`, borderRadius: 1.5 }}><Box sx={{ width: 40, height: 40, bgcolor: `${String(color)}12`, color: String(color), borderRadius: 1, display: 'grid', placeItems: 'center' }}>{icon}</Box><Box minWidth={0} flex={1}><Typography fontWeight={700} fontSize={13} noWrap>{name}</Typography><Typography color="text.secondary" fontSize={11}>{meta}</Typography></Box><IconButton size="small"><DownloadRoundedIcon fontSize="small" /></IconButton></Stack>)}<Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ p: 1.5, border: `1px dashed ${border}`, borderRadius: 1.5, color: 'text.secondary' }}><AddCircleOutlineRoundedIcon /><Typography fontSize={13}>추가 자료</Typography></Stack></Box></CardContent></Card>
      <Alert severity="info" variant="outlined" sx={{ gridColumn: { xl: 'span 12' }, bgcolor: '#F8FBFF', borderColor: '#BFDBFE' }}><Typography fontWeight={700}>검토 및 증빙 안전 원칙</Typography><Typography variant="body2" sx={{ mt: .5 }}>AI 분류·연결·요약 결과는 검토를 돕는 제안입니다. 원장, 원문 증빙, 적용 기준을 사람이 확인하고 승인하기 전에는 회계 결론이나 자동 조치로 확정되지 않습니다.</Typography></Alert>
      {Object.keys(signature).length > 0 && <Card sx={{ ...cardSx, gridColumn: { xl: 'span 12' } }}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}><details><summary style={{ cursor: 'pointer', fontWeight: 700 }}>구조화된 원본 이벤트 데이터</summary><Divider sx={{ my: 2 }} /><Box component="pre" sx={{ m: 0, p: 2, overflowX: 'auto', borderRadius: 1.5, bgcolor: '#F8FAFC', color: 'text.secondary', fontSize: 11, lineHeight: 1.6 }}>{JSON.stringify(signature, null, 2)}</Box></details></CardContent></Card>}
    </Box>
  </Box>
}
