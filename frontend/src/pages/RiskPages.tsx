import {
  Box,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api, Company, Risk } from '../api'
import { StatusBadge } from '../components/StatusBadge'

export function RiskListPage() {
  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get<Company[]>('/companies')).data,
  })
  const company = companies?.[0]
  const { data = [] } = useQuery({
    queryKey: ['risks', company?.id],
    enabled: Boolean(company),
    queryFn: async () => (await api.get<Risk[]>('/risks', { params: { company_id: company!.id } })).data,
  })
  return (
    <Box>
      <Typography variant="h4">Audit Risk</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        AI/Rule이 제시한 검토 후보이며 오류 확정 결과가 아닙니다.
      </Typography>
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Risk</TableCell><TableCell>Level</TableCell><TableCell>Score</TableCell>
              <TableCell>Analysis Route</TableCell><TableCell>Status</TableCell><TableCell>Materiality</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((risk) => (
              <TableRow key={risk.id} hover>
                <TableCell><Link to={`/risks/${risk.id}`}>{risk.title}</Link></TableCell>
                <TableCell><StatusBadge value={risk.level} /></TableCell>
                <TableCell>{risk.score}</TableCell><TableCell>{risk.route}</TableCell>
                <TableCell><StatusBadge value={risk.status} /></TableCell>
                <TableCell>{risk.materiality_level}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Box>
  )
}

export function RiskDetailPage() {
  const { riskId } = useParams()
  const { data: risk } = useQuery({
    queryKey: ['risk', riskId],
    enabled: Boolean(riskId),
    queryFn: async () => (await api.get<Risk & { memory: unknown[] }>(`/risks/${riskId}`)).data,
  })
  if (!risk) return <Typography>Risk를 불러오는 중입니다.</Typography>
  return (
    <Box>
      <Typography variant="h4">{risk.title}</Typography>
      <Box sx={{ display: 'flex', gap: 1, my: 2 }}>
        <StatusBadge value={risk.level} /><StatusBadge value={risk.status} />
        <StatusBadge value={risk.route} />
      </Box>
      <Card>
        <CardContent>
          <Typography variant="h6">Risk Summary</Typography>
          <Typography sx={{ mt: 1 }}>{risk.statement}</Typography>
          {risk.package?.evidence_status === 'EVIDENCE_ENRICHMENT_REQUIRED' && (
            <Box sx={{ mt: 2, p: 2, borderRadius: 1, bgcolor: 'warning.lighter' }}>
              <Typography color="warning.dark" fontWeight={700}>근거보강 필요</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                AI가 검토 가능성을 식별했습니다. 승인된 기준서·사례 또는 아래 사실관계를 보강한 뒤 최종 검토하세요.
              </Typography>
              {(risk.package?.missing_facts?.length ?? 0) > 0 && (
                <List dense>{risk.package.missing_facts.map((fact) => <ListItem key={fact}><ListItemText primary={fact} /></ListItem>)}</List>
              )}
            </Box>
          )}
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6">예상 감사 질문</Typography>
          <List>{risk.package.expected_questions.map((q) => <ListItem key={q}><ListItemText primary={q} /></ListItem>)}</List>
          <Typography variant="h6">필요 증빙</Typography>
          <List>{risk.package.evidence_checklist.map((e) => <ListItem key={e}><ListItemText primary={e} /></ListItem>)}</List>
          <Typography variant="h6">관련 기준 후보</Typography>
          <List>{risk.package.references.map((r, i) => <ListItem key={i}><ListItemText primary={`${r.type} ${r.code}`} secondary={r.status} /></ListItem>)}</List>
          {risk.package.references.some((r) => r.status === 'REFERENCE_REQUIRED') && (
            <Typography color="warning.main">
              승인된 Knowledge 문단이 연결되기 전에는 Package를 최종 승인할 수 없습니다.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}
