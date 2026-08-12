import { Alert, Box, Card, Chip, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, Company, RiskReviewSummary } from '../api'

const primary = '#0056B0'
const border = '#E5E7EB'
const cardSx = { borderColor: border, borderRadius: '12px', boxShadow: '0 1px 2px rgba(16,24,40,.04)' }
const decisionLabel: Record<RiskReviewSummary['review_decision'], string> = { CHECK: 'Check', PENDING: 'Pending', PASS: 'Pass' }
const severityLabel: Record<RiskReviewSummary['severity'], string> = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' }

function formatExposure(value: number) { return `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format((value || 0) / 1_000_000)}백만원` }
function formatTransferredAt(value: string) {
  if (Number.isNaN(new Date(value).getTime())) return '-'
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)).replace(',', '')
}
function DecisionChip({ value }: { value: RiskReviewSummary['review_decision'] }) { return <Chip size="small" label={decisionLabel[value]} color={value === 'PENDING' ? 'warning' : 'primary'} variant="outlined" /> }
function SeverityChip({ value }: { value: RiskReviewSummary['severity'] }) { return <Chip size="small" label={severityLabel[value]} color={value === 'HIGH' ? 'error' : value === 'MEDIUM' ? 'warning' : 'primary'} variant={value === 'HIGH' ? 'filled' : 'outlined'} /> }

export function RiskReviewPage() {
  const { data: companies, isLoading: isCompanyLoading, isError: isCompanyError } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<Company[]>('/companies')).data })
  const company = companies?.[0]
  const { data = [], isLoading, isError } = useQuery({ queryKey: ['risk-reviews', company?.id], enabled: Boolean(company), queryFn: async () => (await api.get<RiskReviewSummary[]>('/risk-reviews', { params: { company_id: company!.id } })).data })
  const activeCases = data.filter((reviewCase) => reviewCase.review_decision !== 'PASS')
  return <Box>
    <Typography variant="h4">리스크 검토</Typography><Typography color="text.secondary" sx={{ mt: .75, mb: 3 }}>검토 대상으로 이관된 Check 및 Pending 리스크만 관리합니다.</Typography>
    {isCompanyError || isError ? <Alert severity="error">리스크 검토 데이터를 불러오지 못했습니다.</Alert> : !isCompanyLoading && !company ? <Alert severity="info">등록된 회사가 없습니다.</Alert> : <Card sx={cardSx}><Box sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 1000 }}><TableHead><TableRow><TableCell>리스크 ID</TableCell><TableCell>이관된 분석 결과</TableCell><TableCell align="right">노출금액</TableCell><TableCell>검토 분류</TableCell><TableCell>심각도</TableCell><TableCell>상태</TableCell><TableCell>이관 일시</TableCell></TableRow></TableHead><TableBody>{isCompanyLoading || (company && isLoading) ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 8 }}><CircularProgress size={28} /></TableCell></TableRow> : activeCases.length === 0 ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 8, color: 'text.secondary' }}>검토할 이관 리스크가 없습니다.</TableCell></TableRow> : activeCases.map((reviewCase) => <TableRow key={reviewCase.risk_code} hover><TableCell><Typography component={Link} to={`/risk-reviews/${encodeURIComponent(reviewCase.risk_code)}`} sx={{ color: primary, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>{reviewCase.risk_code || '-'}</Typography></TableCell><TableCell><Typography component={Link} to={`/risk-reviews/${encodeURIComponent(reviewCase.risk_code)}`} sx={{ color: 'text.primary', fontWeight: 600, textDecoration: 'none' }}>{reviewCase.title}</Typography><Typography color="text.secondary" fontSize={12} sx={{ mt: .5 }}>{reviewCase.statement}</Typography></TableCell><TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{formatExposure(reviewCase.exposure_amount)}</TableCell><TableCell><DecisionChip value={reviewCase.review_decision} /></TableCell><TableCell><SeverityChip value={reviewCase.severity} /></TableCell><TableCell>{reviewCase.status}</TableCell><TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTransferredAt(reviewCase.transferred_at)}</TableCell></TableRow>)}</TableBody></Table></Box><Box sx={{ px: 2.5, py: 1.75, color: 'text.secondary', fontSize: 13 }}>현재 검토 대상 {activeCases.length}건</Box></Card>}
  </Box>
}
