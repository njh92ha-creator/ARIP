import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { AccountingEvent, api, Company, Risk } from '../api'

const border = '#E5E7EB'
const primary = '#0056B0'
const cardSx = { borderColor: border, borderRadius: '12px', boxShadow: '0 1px 2px rgba(16,24,40,.04)' }
const labelSx = { color: '#667085', fontSize: 11, fontWeight: 700, letterSpacing: '.03em' }

type JournalLine = {
  id: string
  document_number?: string
  account_code?: string
  account_name?: string
  posting_date?: string
  local_amount?: number | string
  debit_credit_indicator?: string
}
type EventDetails = AccountingEvent & {
  journalLines?: JournalLine[]
  relatedRisks?: Risk[]
}

function Status({ value }: { value: string }) {
  const review = value.includes('REVIEW')
  return <Chip label={value.replaceAll('_', ' ')} size="small" color={review ? 'warning' : 'success'} variant="outlined" />
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: 18, fontWeight: 700, pb: 1.5, borderBottom: `1px solid ${border}` }}>{children}</Typography>
}

export function EventListPage() {
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<Company[]>('/companies')).data })
  const company = companies?.[0]
  const { data = [], isLoading } = useQuery({
    queryKey: ['events', company?.id],
    enabled: Boolean(company),
    queryFn: async () => (await api.get<AccountingEvent[]>('/events', { params: { company_id: company!.id } })).data,
  })

  return <Box>
    <Typography variant="h4">회계사건(Event)</Typography>
    <Typography color="text.secondary" sx={{ mt: .75, mb: 3 }}>업로드한 총계정원장을 분석해 생성된 회계사건만 표시합니다.</Typography>
    <Card sx={cardSx}>
      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 780 }}>
          <TableHead><TableRow><TableCell>이벤트 ID</TableCell><TableCell>분석 결과</TableCell><TableCell>유형</TableCell><TableCell align="right">분석 금액</TableCell><TableCell align="right">분류 신뢰도</TableCell><TableCell>상태</TableCell></TableRow></TableHead>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 8 }}><CircularProgress size={28} /></TableCell></TableRow> :
              data.length === 0 ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 8, color: 'text.secondary' }}>분석으로 생성된 회계사건이 없습니다.</TableCell></TableRow> :
              data.map((event) => <TableRow key={event.id} hover>
                <TableCell><Typography component={Link} to={`/events/${event.id}`} sx={{ color: primary, fontWeight: 700, textDecoration: 'none' }}>{event.id}</Typography></TableCell>
                <TableCell><Typography component={Link} to={`/events/${event.id}`} sx={{ color: 'text.primary', fontWeight: 600, textDecoration: 'none' }}>{event.title}</Typography></TableCell>
                <TableCell>{event.event_type}</TableCell>
                <TableCell align="right">{Number(event.amount).toLocaleString()} {event.currency}</TableCell>
                <TableCell align="right">{Math.round(event.classification_confidence * 100)}%</TableCell>
                <TableCell><Status value={event.status} /></TableCell>
              </TableRow>)}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ px: 2.5, py: 1.75, color: 'text.secondary', fontSize: 13 }}>현재 분석 결과 {data.length}건</Box>
    </Card>
  </Box>
}

function EventFacts({ lines }: { lines: JournalLine[] }) {
  const accounts = [...new Set(lines.map((line) => line.account_name || line.account_code).filter(Boolean))]
  const documents = [...new Set(lines.map((line) => line.document_number).filter(Boolean))]
  return <Card sx={cardSx}><CardContent sx={{ p: 2.5 }}>
    <SectionTitle>분석 입력 근거</SectionTitle>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,1fr)' }, gap: 2, mt: 2.25 }}>
      <Box><Typography sx={labelSx}>관련 계정</Typography><Typography sx={{ mt: .5, fontWeight: 700 }}>{accounts.join(', ') || '-'}</Typography></Box>
      <Box><Typography sx={labelSx}>원장 전표 수</Typography><Typography sx={{ mt: .5, fontWeight: 700 }}>{lines.length}건</Typography></Box>
      <Box><Typography sx={labelSx}>전표 번호</Typography><Typography sx={{ mt: .5, fontWeight: 700 }}>{documents.join(', ') || '-'}</Typography></Box>
    </Box>
    <Table size="small" sx={{ mt: 2.5 }}><TableHead><TableRow><TableCell>전표</TableCell><TableCell>계정</TableCell><TableCell>전기일</TableCell><TableCell align="right">금액</TableCell></TableRow></TableHead><TableBody>
      {lines.map((line) => <TableRow key={line.id}><TableCell>{line.document_number || '-'}</TableCell><TableCell>{line.account_name || line.account_code || '-'}</TableCell><TableCell>{line.posting_date || '-'}</TableCell><TableCell align="right">{Number(line.local_amount || 0).toLocaleString()}</TableCell></TableRow>)}
    </TableBody></Table>
  </CardContent></Card>
}

export function EventDetailPage() {
  const { eventId } = useParams()
  const { data } = useQuery({ queryKey: ['event', eventId], enabled: Boolean(eventId), queryFn: async () => (await api.get<EventDetails>(`/events/${eventId}`)).data })
  if (!data) return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress size={30} /></Box>

  const lines = data.journalLines ?? []
  const relatedRisks = data.relatedRisks ?? []
  return <Box>
    <Typography variant="h4">{data.title}</Typography>
    <Stack direction="row" spacing={1} sx={{ mt: 1.25, mb: 3 }}><Status value={data.status} /><Chip label={data.event_type} size="small" /></Stack>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3,1fr)' }, gap: 2.5, mb: 3 }}>
      <Card sx={cardSx}><CardContent sx={{ p: 2.5 }}><Typography sx={labelSx}>분석 금액</Typography><Typography sx={{ mt: .5, fontSize: 28, fontWeight: 700, color: primary }}>{Number(data.amount).toLocaleString()} {data.currency}</Typography></CardContent></Card>
      <Card sx={cardSx}><CardContent sx={{ p: 2.5 }}><Typography sx={labelSx}>분류 신뢰도</Typography><Typography sx={{ mt: .5, fontSize: 28, fontWeight: 700 }}>{Math.round(data.classification_confidence * 100)}%</Typography></CardContent></Card>
      <Card sx={cardSx}><CardContent sx={{ p: 2.5 }}><Typography sx={labelSx}>연결 리스크</Typography><Typography sx={{ mt: .5, fontSize: 28, fontWeight: 700 }}>{relatedRisks.length}건</Typography></CardContent></Card>
    </Box>
    <Stack spacing={3}>
      <EventFacts lines={lines} />
      <Card sx={cardSx}><CardContent sx={{ p: 2.5 }}><SectionTitle>연결된 분석 리스크</SectionTitle><Stack spacing={1.25} sx={{ mt: 2 }}>
        {relatedRisks.length ? relatedRisks.map((risk) => <Box key={risk.id} component={Link} to={`/risks/${risk.id}`} sx={{ display: 'block', p: 1.5, border: `1px solid ${border}`, borderRadius: 1.5, textDecoration: 'none', color: 'text.primary' }}><Stack direction="row" justifyContent="space-between" spacing={2}><Typography fontWeight={700}>{risk.title}</Typography><Chip label={risk.level} size="small" /></Stack><Typography color="text.secondary" fontSize={13} sx={{ mt: .75 }}>{risk.statement}</Typography></Box>) : <Alert severity="info">이 이벤트에서 생성된 리스크가 없습니다.</Alert>}
      </Stack></CardContent></Card>
    </Stack>
  </Box>
}
