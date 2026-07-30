import { Box, Card, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { api, Company } from '../api'

export function JournalPage() {
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<Company[]>('/companies')).data })
  const company = companies?.[0]
  const { data = [] } = useQuery({
    queryKey: ['journals', company?.id], enabled: Boolean(company),
    queryFn: async () => (await api.get('/journals', { params: { company_id: company!.id, limit: 100 } })).data,
  })
  return <Box><Typography variant="h4" sx={{ mb: 3 }}>Journal Drill-down</Typography><Card><Table size="small">
    <TableHead><TableRow><TableCell>전표번호</TableCell><TableCell>일자</TableCell><TableCell>계정</TableCell><TableCell>적요</TableCell><TableCell>차대</TableCell><TableCell>금액</TableCell></TableRow></TableHead>
    <TableBody>{data.map((line: any) => <TableRow key={line.id}><TableCell>{line.document_number}</TableCell><TableCell>{line.posting_date}</TableCell><TableCell>{line.account_code} {line.account_name}</TableCell><TableCell>{line.line_text}</TableCell><TableCell>{line.debit_credit_indicator}</TableCell><TableCell>{Number(line.local_amount).toLocaleString()}</TableCell></TableRow>)}</TableBody>
  </Table></Card></Box>
}

