import { Alert, Box, Card, CardContent, Chip, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { useQuery } from '@tanstack/react-query'
import { api, Company } from '../api'

const cardSx = { borderColor: '#E5E7EB', borderRadius: 3, boxShadow: 'none' }

export function JournalPage() {
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<Company[]>('/companies')).data })
  const company = companies?.[0]
  const { data = [] } = useQuery({
    queryKey: ['journals', company?.id], enabled: Boolean(company),
    queryFn: async () => (await api.get('/journals', { params: { company_id: company!.id, limit: 100 } })).data,
  })

  return <Box>
    <Box sx={{ mb: 3 }}><Typography sx={{ color: 'text.secondary', fontSize: 13, mb: 0.75 }}>홈　›　전표 조회</Typography><Typography variant="h4">전표 조회</Typography><Typography color="text.secondary" sx={{ mt: 0.75 }}>분석 대상 전표를 확인하고 원천 증빙과 함께 검토합니다.</Typography></Box>
    <Card sx={{ ...cardSx, mb: 3 }}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'center' }}><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><Chip label="전체 기간" variant="outlined" /><Chip label="전체 계정" variant="outlined" /><Chip label="차변 / 대변" variant="outlined" /></Stack><TextField size="small" placeholder="전표번호, 계정, 적요 검색" sx={{ width: { xs: '100%', md: 310 } }} InputProps={{ startAdornment: <SearchRoundedIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }} /></Stack><Divider sx={{ my: 2.25 }} /><Stack direction="row" spacing={1} alignItems="baseline"><Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>조회 결과</Typography><Typography sx={{ fontSize: 28, fontWeight: 700, color: 'primary.main' }}>{data.length}</Typography><Typography color="text.secondary">건</Typography></Stack></CardContent></Card>
    <Card sx={{ ...cardSx, overflow: 'hidden' }}><Box sx={{ overflowX: 'auto' }}><Table size="small" sx={{ minWidth: 940 }}><TableHead><TableRow><TableCell>전표번호</TableCell><TableCell>전기일</TableCell><TableCell>계정</TableCell><TableCell>적요</TableCell><TableCell>차변 / 대변</TableCell><TableCell align="right">금액</TableCell></TableRow></TableHead><TableBody>{data.map((line: any) => <TableRow key={line.id} hover sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}><TableCell sx={{ fontWeight: 700, color: 'primary.main', whiteSpace: 'nowrap' }}>{line.document_number}</TableCell><TableCell sx={{ whiteSpace: 'nowrap' }}>{line.posting_date}</TableCell><TableCell><Typography fontWeight={700} fontSize={14}>{line.account_code}</Typography><Typography variant="body2" color="text.secondary">{line.account_name}</Typography></TableCell><TableCell sx={{ minWidth: 270 }}>{line.line_text}</TableCell><TableCell>{line.debit_credit_indicator}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{Number(line.local_amount).toLocaleString()}</TableCell></TableRow>)}</TableBody></Table></Box><Box sx={{ px: 2.5, py: 1.75, borderTop: '1px solid #E5E7EB', color: 'text.secondary', fontSize: 14 }}>최대 100건까지 표시됩니다.</Box></Card>
    <Alert icon={<AutoAwesomeRoundedIcon fontSize="inherit" />} severity="info" variant="outlined" sx={{ mt: 3, borderColor: '#BFDBFE', bgcolor: '#F8FBFF' }}><Typography component="span" fontWeight={700}>검토 안내</Typography>　전표 목록과 자동 분석 신호는 검토 보조 정보입니다. 전표 원본, 증빙 문서, 승인 기록을 확인한 뒤 담당자가 결론을 내려야 합니다.</Alert>
  </Box>
}
