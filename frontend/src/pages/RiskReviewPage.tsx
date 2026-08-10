import { Box, Card, Chip, CircularProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, Company, Risk } from '../api'

const primary = '#0056B0'
const border = '#E5E7EB'
const label: Record<string, string> = { CHECK: 'Check', PENDING: 'Pending', PASS: 'Pass' }

export function RiskReviewPage() {
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<Company[]>('/companies')).data })
  const company = companies?.[0]
  const { data = [], isLoading } = useQuery({
    queryKey: ['risk-reviews', company?.id],
    enabled: Boolean(company),
    queryFn: async () => (await api.get<Risk[]>('/risk-reviews', { params: { company_id: company!.id } })).data,
  })

  return <Box>
    <Typography variant="h4">리스크 검토</Typography>
    <Typography color="text.secondary" sx={{ mt: .75, mb: 3 }}>Check 및 Pending으로 분류한 리스크만 관리합니다.</Typography>
    <Card variant="outlined" sx={{ borderColor: border, borderRadius: 3 }}>
      <Box sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 800 }}>
        <TableHead><TableRow><TableCell>리스크 ID</TableCell><TableCell>분석 결과</TableCell><TableCell>검토 분류</TableCell><TableCell>추천</TableCell><TableCell>분석 일시</TableCell></TableRow></TableHead>
        <TableBody>
          {isLoading ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 8 }}><CircularProgress size={28} /></TableCell></TableRow> :
            data.length === 0 ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 8, color: 'text.secondary' }}>검토할 리스크가 없습니다.</TableCell></TableRow> :
              data.map((risk) => <TableRow key={risk.id} hover>
                <TableCell><Typography component={Link} to={`/risks/${risk.id}`} sx={{ color: primary, fontWeight: 700, textDecoration: 'none' }}>{risk.id}</Typography></TableCell>
                <TableCell><Typography component={Link} to={`/risks/${risk.id}`} sx={{ color: 'text.primary', fontWeight: 600, textDecoration: 'none' }}>{risk.title}</Typography><Typography color="text.secondary" fontSize={12} sx={{ mt: .5 }}>{risk.statement}</Typography></TableCell>
                <TableCell><Chip size="small" label={label[risk.review_decision ?? 'CHECK']} color={risk.review_decision === 'PENDING' ? 'warning' : 'primary'} /></TableCell>
                <TableCell>{risk.review_recommendation ? `${label[risk.review_recommendation.decision]} · 유사 ${risk.review_recommendation.matched_cases}건` : '-'}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{risk.analyzed_at ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(risk.analyzed_at)).replace(',', '') : '-'}</TableCell>
              </TableRow>)}
        </TableBody>
      </Table></Box>
      <Stack direction="row" spacing={2} sx={{ px: 2.5, py: 1.5 }}><Typography fontSize={13} color="text.secondary">총 {data.length}건</Typography></Stack>
    </Card>
  </Box>
}
