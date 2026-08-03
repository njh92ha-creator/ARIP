import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { AccountingEvent, api, Company } from '../api'
import { StatusBadge } from '../components/StatusBadge'

const cardSx = { borderColor: '#E5E7EB', borderRadius: 3, boxShadow: 'none' }
const labelSx = { color: 'text.secondary', fontSize: 12, fontWeight: 700, letterSpacing: '0.02em' }

function EventMetric({ label, value, emphasis = false }: { label: string; value: React.ReactNode; emphasis?: boolean }) {
  return <Box sx={{ p: 2.25, minWidth: 0, textAlign: 'center', borderRight: { md: '1px solid #E5E7EB' }, '&:last-child': { borderRight: 0 } }}><Typography sx={labelSx}>{label}</Typography><Box sx={{ mt: 0.8, fontWeight: 700, color: emphasis ? 'primary.main' : 'text.primary', fontSize: emphasis ? 26 : 16 }}>{value}</Box></Box>
}

export function EventListPage() {
  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get<Company[]>('/companies')).data,
  })
  const company = companies?.[0]
  const { data = [] } = useQuery({
    queryKey: ['events', company?.id],
    enabled: Boolean(company),
    queryFn: async () => (await api.get<AccountingEvent[]>('/events', { params: { company_id: company!.id } })).data,
  })
  return (
    <Box>
      <Box sx={{ mb: 3 }}><Typography sx={{ color: 'text.secondary', fontSize: 13, mb: 0.75 }}>홈　›　회계사건(Event)</Typography><Typography variant="h4">회계사건(Event)</Typography><Typography color="text.secondary" sx={{ mt: 0.75 }}>분류된 회계사건을 검토하고 관련 리스크의 근거를 확인합니다.</Typography></Box>
      <Card sx={{ ...cardSx, overflow: 'hidden' }}><Box sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 780 }}>
        <TableHead><TableRow><TableCell>이벤트 ID</TableCell><TableCell>제목</TableCell><TableCell>유형</TableCell><TableCell align="right">금액</TableCell><TableCell align="right">분류 신뢰도</TableCell><TableCell>상태</TableCell></TableRow></TableHead>
        <TableBody>{data.map((event) => <TableRow key={event.id} hover sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}><TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}><Link to={`/events/${event.id}`}>{event.id}</Link></TableCell><TableCell sx={{ minWidth: 280 }}><Link to={`/events/${event.id}`} style={{ color: 'inherit', fontWeight: 600 }}>{event.title}</Link></TableCell><TableCell>{event.event_type}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{Number(event.amount).toLocaleString()} {event.currency}</TableCell><TableCell align="right">{Math.round(event.classification_confidence * 100)}%</TableCell><TableCell><StatusBadge value={event.status} /></TableCell></TableRow>)}</TableBody>
      </Table></Box><Box sx={{ px: 2.5, py: 1.75, borderTop: '1px solid #E5E7EB', color: 'text.secondary', fontSize: 14 }}>표시 결과: {data.length}건</Box></Card>
      <Alert severity="info" variant="outlined" sx={{ mt: 3, borderColor: '#BFDBFE', bgcolor: '#F8FBFF' }}>이벤트 분류 결과는 검토 보조 정보입니다. 원장, 증빙, 회계 기준을 사람이 확인한 후 후속 조치를 결정하세요.</Alert>
    </Box>
  )
}

export function EventDetailPage() {
  const { eventId } = useParams()
  const { data } = useQuery({
    queryKey: ['event', eventId],
    enabled: Boolean(eventId),
    queryFn: async () => (await api.get(`/events/${eventId}`)).data,
  })
  if (!data) return <Typography>이벤트 정보를 불러오는 중입니다.</Typography>

  const signature = data.canonical_signature ?? {}
  const journalLines = data.journalLines ?? []
  const relatedRisks = data.risks ?? data.relatedRisks ?? []
  const eventAmount = Number(data.amount ?? signature.amount ?? 0)
  const eventPeriod = signature.posting_period ?? signature.posting_date ?? data.posting_date ?? '-'
  const account = signature.account_name ?? signature.account_code ?? data.account_name ?? '확인 필요'

  return (
    <Box>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2.5} sx={{ mb: 3 }}>
        <Box><Button component={Link} to="/events" size="small" startIcon={<ArrowBackRoundedIcon />} sx={{ mb: 1, px: 0, color: 'text.secondary' }}>회계사건 목록으로 돌아가기</Button><Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap><Typography variant="h4">{data.title}</Typography><StatusBadge value={data.status} /></Stack></Box>
        <Stack direction="row" spacing={1.25} alignSelf={{ xs: 'flex-start', lg: 'flex-end' }}><Button variant="outlined" startIcon={<EditRoundedIcon />} sx={{ borderColor: '#E5E7EB', color: 'text.primary' }}>이벤트 편집</Button><Button variant="contained" startIcon={<InsightsRoundedIcon />}>관련 리스크 보기 ({relatedRisks.length})</Button></Stack>
      </Stack>

      <Card sx={{ ...cardSx, mb: 3 }}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(6, 1fr)' } }}>
        <EventMetric label="대상 기간" value={eventPeriod} /><EventMetric label="관련 계정" value={account} /><EventMetric label="리스크 식별" value={`${relatedRisks.length}건`} emphasis /><EventMetric label="누적 발생 금액" value={<>{eventAmount.toLocaleString()}<Typography component="span" sx={{ ml: 0.5, fontSize: 12, color: 'text.secondary' }}>{data.currency ?? 'KRW'}</Typography></>} emphasis /><EventMetric label="이벤트 유형" value={data.event_type ?? '-'} /><EventMetric label="분류 신뢰도" value={`${Math.round((data.classification_confidence ?? 0) * 100)}%`} />
      </Box></Card>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(12, minmax(0, 1fr))' }, gap: 3 }}>
        <Card sx={{ ...cardSx, gridColumn: { lg: 'span 4' } }}><CardContent sx={{ p: 2.75, '&:last-child': { pb: 2.75 } }}><Typography variant="h6">이벤트 개요</Typography><Divider sx={{ my: 2 }} /><Typography sx={labelSx}>설명</Typography><Typography sx={{ mt: 1, color: 'text.secondary', lineHeight: 1.75 }}>{data.description ?? data.title}</Typography><Typography sx={{ ...labelSx, mt: 2.5 }}>연결된 리스크 핵심 키워드</Typography><Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} sx={{ mt: 1 }}>{relatedRisks.slice(0, 4).map((risk: any) => <Chip key={risk.id ?? risk.title} label={risk.title ?? risk.id} size="small" sx={{ bgcolor: '#EAF2FF', color: '#124F9E' }} />)}{relatedRisks.length === 0 && <Typography variant="body2" color="text.secondary">연결된 리스크 정보가 없습니다.</Typography>}</Stack><Box sx={{ mt: 2.5, p: 1.5, borderRadius: 2, bgcolor: '#F2F4F6' }}><Stack direction="row" spacing={1} alignItems="center"><AutoAwesomeRoundedIcon color="primary" fontSize="small" /><Typography fontWeight={700} color="primary.main">AI 분석 요약</Typography></Stack><Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.6 }}>이 이벤트는 자동 분류된 분석 대상입니다. 근거 자료를 확인한 뒤 담당자가 최종 판단해야 합니다.</Typography></Box></CardContent></Card>

        <Card sx={{ ...cardSx, gridColumn: { lg: 'span 5' } }}><CardContent sx={{ p: 2.75, '&:last-child': { pb: 2.75 }, minHeight: 330, display: 'flex', flexDirection: 'column' }}><Stack direction="row" justifyContent="space-between"><Typography variant="h6">누적 금액 추이</Typography><Typography sx={labelSx}>현재 이벤트</Typography></Stack><Divider sx={{ my: 2 }} /><Box sx={{ mt: 'auto', height: 190, display: 'flex', alignItems: 'end', gap: 1.5, borderBottom: '1px solid #E5E7EB', pb: 1 }}>{[35, 44, 58, 68, 82, 100].map((height, index) => <Box key={height} sx={{ flex: 1, minWidth: 20, textAlign: 'center' }}><Box sx={{ height: `${height}%`, minHeight: 20, borderRadius: '4px 4px 0 0', bgcolor: index === 5 ? 'primary.main' : '#EEF1F5' }} /><Typography sx={{ mt: 0.75, fontSize: 12, color: index === 5 ? 'primary.main' : 'text.secondary', fontWeight: index === 5 ? 700 : 400 }}>{index + 2}월</Typography></Box>)}</Box><Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}><Typography variant="body2" color="text.secondary">누적 금액은 원장 확인 후 확정됩니다.</Typography><Typography color="error.main" fontWeight={700}>검토 필요</Typography></Stack></CardContent></Card>

        <Card sx={{ ...cardSx, gridColumn: { lg: 'span 3' } }}><CardContent sx={{ p: 2.75, '&:last-child': { pb: 2.75 } }}><Typography variant="h6">이벤트 타임라인</Typography><Divider sx={{ my: 2 }} /><Stack spacing={2.25}>{[{ title: '증빙 서류 업로드', detail: '원천 증빙 확인 필요', color: 'primary.main' }, { title: '이벤트 분류 완료', detail: `신뢰도 ${Math.round((data.classification_confidence ?? 0) * 100)}%`, color: 'warning.main' }, { title: '회계사건 생성', detail: eventPeriod, color: '#CBD5E1' }].map((item) => <Stack key={item.title} direction="row" spacing={1.25}><Box sx={{ mt: 0.5, width: 12, height: 12, borderRadius: '50%', bgcolor: item.color, boxShadow: `0 0 0 4px ${item.color === 'primary.main' ? '#DBEAFE' : '#F8FAFC'}`, flex: '0 0 auto' }} /><Box><Typography fontWeight={700} fontSize={14}>{item.title}</Typography><Typography variant="body2" color="text.secondary">{item.detail}</Typography></Box></Stack>)}</Stack></CardContent></Card>

        <Card sx={{ ...cardSx, gridColumn: { lg: 'span 8' }, overflow: 'hidden' }}><Box sx={{ px: 2.75, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E7EB' }}><Typography variant="h6">연결된 리스크</Typography><Typography color="primary.main" fontWeight={700} fontSize={14}>전체보기</Typography></Box><Box sx={{ overflowX: 'auto' }}><Table size="small" sx={{ minWidth: 570 }}><TableHead><TableRow><TableCell>리스크 ID</TableCell><TableCell>제목</TableCell><TableCell>심각도</TableCell><TableCell>상태</TableCell></TableRow></TableHead><TableBody>{relatedRisks.length > 0 ? relatedRisks.map((risk: any) => <TableRow key={risk.id ?? risk.title}><TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>{risk.id ?? '-'}</TableCell><TableCell>{risk.title ?? '-'}</TableCell><TableCell>{risk.level ? <StatusBadge value={risk.level} /> : '-'}</TableCell><TableCell>{risk.status ? <StatusBadge value={risk.status} /> : '-'}</TableCell></TableRow>) : <TableRow><TableCell colSpan={4} sx={{ color: 'text.secondary' }}>연결된 리스크 정보가 제공되지 않았습니다.</TableCell></TableRow>}</TableBody></Table></Box></Card>

        <Card sx={{ ...cardSx, gridColumn: { lg: 'span 4' } }}><CardContent sx={{ p: 2.75, '&:last-child': { pb: 2.75 } }}><Typography variant="h6">전표 요약 (Top 5)</Typography><Divider sx={{ my: 2 }} /><Stack spacing={1}>{journalLines.slice(0, 5).map((line: any, index: number) => <Box key={line.id ?? index} sx={{ p: 1.25, border: '1px solid #E5E7EB', borderRadius: 1.5 }}><Typography fontWeight={700} fontSize={13}>{line.document_number ?? line.account_name ?? `전표 ${index + 1}`}</Typography><Typography variant="body2" color="text.secondary">{line.posting_date ?? '-'}　{Number(line.local_amount ?? line.amount ?? 0).toLocaleString()}</Typography></Box>)}{journalLines.length === 0 && <Typography variant="body2" color="text.secondary">연결된 전표가 없습니다.</Typography>}</Stack></CardContent></Card>

        <Card sx={{ ...cardSx, gridColumn: { lg: 'span 12' } }}><CardContent sx={{ p: 2.75, '&:last-child': { pb: 2.75 } }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6">구조화된 사건 정보</Typography><Typography sx={labelSx}>검토용 데이터</Typography></Stack><Divider sx={{ my: 2 }} /><Box component="pre" sx={{ m: 0, p: 2, overflowX: 'auto', borderRadius: 2, bgcolor: '#F8FAFC', color: 'text.secondary', fontSize: 12, lineHeight: 1.6 }}>{JSON.stringify(signature, null, 2)}</Box></CardContent></Card>
      </Box>
    </Box>
  )
}
