import { Box, Card, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { AccountingEvent, api, Company } from '../api'
import { StatusBadge } from '../components/StatusBadge'

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
      <Typography variant="h4" sx={{ mb: 3 }}>Accounting Events</Typography>
      <Card>
        <Table><TableHead><TableRow><TableCell>Event</TableCell><TableCell>Type</TableCell><TableCell>Amount</TableCell><TableCell>Confidence</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
          <TableBody>{data.map((event) => <TableRow key={event.id}>
            <TableCell><Link to={`/events/${event.id}`}>{event.title}</Link></TableCell><TableCell>{event.event_type}</TableCell>
            <TableCell>{Number(event.amount).toLocaleString()} {event.currency}</TableCell><TableCell>{Math.round(event.classification_confidence * 100)}%</TableCell>
            <TableCell><StatusBadge value={event.status} /></TableCell></TableRow>)}</TableBody>
        </Table>
      </Card>
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
  if (!data) return <Typography>Event를 불러오는 중입니다.</Typography>
  return (
    <Box>
      <Typography variant="h4">{data.title}</Typography>
      <Typography color="text.secondary" sx={{ my: 1 }}>Signature v{data.canonical_signature.version} · Hash {data.event_hash.slice(0, 16)}…</Typography>
      <Card sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6">구조화 사실</Typography>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(data.canonical_signature, null, 2)}</pre>
        <Typography variant="h6" sx={{ mt: 3 }}>연결 전표</Typography>
        <Typography>{data.journalLines.length}개 Line</Typography>
      </Card>
    </Box>
  )
}

