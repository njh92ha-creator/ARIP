import { Box, Card, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { api, Company } from '../api'
import { KpiCard } from '../components/KpiCard'
import { StatusBadge } from '../components/StatusBadge'

export function VariancePage() {
  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get<Company[]>('/companies')).data,
  })
  const company = companies?.[0]
  const { data } = useQuery({
    queryKey: ['variance-dashboard', company?.id],
    enabled: Boolean(company),
    queryFn: async () => (await api.get('/account-variance/dashboard', { params: { company_id: company!.id } })).data,
  })
  const observations = data?.observations ?? []
  return (
    <Box>
      <Typography variant="h4">Account Variance Intelligence</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Audit Risk Score와 분리된 계정 증감 점검 화면입니다.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
        <KpiCard label="점검대상 계정" value={data?.flaggedAccounts ?? 0} />
        <KpiCard label="증감 노출금액" value={Number(data?.exposureAmount ?? 0).toLocaleString()} />
        <KpiCard label="분리 상태" value="독립" helper={data?.riskSeparation} />
      </Box>
      <Card>
        <Table>
          <TableHead><TableRow><TableCell>계정</TableCell><TableCell>분류/기준</TableCell><TableCell>현재값</TableCell><TableCell>비교값</TableCell><TableCell>증감액</TableCell><TableCell>증감률</TableCell><TableCell>Trigger</TableCell><TableCell>상태</TableCell></TableRow></TableHead>
          <TableBody>{observations.map((o: any) => <TableRow key={o.id}>
            <TableCell>{o.account_code}<br />{o.account_name}</TableCell><TableCell>{o.category}<br />{o.measurement_basis}</TableCell>
            <TableCell>{Number(o.current_value).toLocaleString()}</TableCell><TableCell>{Number(o.comparison_value).toLocaleString()}</TableCell>
            <TableCell>{Number(o.delta_amount).toLocaleString()}</TableCell><TableCell>{o.delta_rate == null ? 'N/A' : `${(Number(o.delta_rate) * 100).toFixed(1)}%`}</TableCell>
            <TableCell>{o.triggered_by.join(', ')}</TableCell><TableCell><StatusBadge value={o.review_status} /></TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </Card>
    </Box>
  )
}

