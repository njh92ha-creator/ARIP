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
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { AccountingEvent, api, Company, Risk } from '../api'
import { RiskReviewDecisionCard } from '../components/RiskReviewDecisionCard'

const border = '#E5E7EB'
const primary = '#0056B0'
const cardSx = { borderColor: border, borderRadius: '12px', boxShadow: '0 1px 2px rgba(16,24,40,.04)' }
const labelSx = { color: '#667085', fontSize: 11, fontWeight: 700, letterSpacing: '.03em' }

type JournalLine = { id: string; document_number?: string; account_code?: string; account_name?: string; posting_date?: string; debit_credit_indicator?: string; local_amount?: number | string; header_text?: string; line_text?: string }
type RiskDetail = Risk & {
  memory: unknown[]
  crossFindings: Array<{ id: string; title: string; statement: string; finding_type: string }>
  event?: AccountingEvent
  journalLines?: JournalLine[]
}

function SeverityPill({ value }: { value: string }) {
  const colors: Record<string, { color: string; bg: string }> = {
    HIGH: { color: '#B42318', bg: '#FEE4E2' },
    CRITICAL: { color: '#B42318', bg: '#FEE4E2' },
    MEDIUM: { color: '#B54708', bg: '#FEF0C7' },
    LOW: { color: '#175CD3', bg: '#EFF8FF' },
  }
  const meta = colors[value] ?? colors.LOW
  return <Chip label={value} size="small" sx={{ color: meta.color, bgcolor: meta.bg, fontWeight: 700 }} />
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: 18, fontWeight: 700, pb: 1.5, borderBottom: `1px solid ${border}` }}>{children}</Typography>
}

function Empty({ text }: { text: string }) {
  return <Typography color="text.secondary" sx={{ py: 2 }}>{text}</Typography>
}

function formatAnalysisDate(value?: string | null) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '-'
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value)).replace(',', '')
}

export function RiskListPage() {
  const { data: companies, isLoading: areCompaniesLoading } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<Company[]>('/companies')).data })
  const company = companies?.[0]
  const { data = [], isLoading } = useQuery({
    queryKey: ['risks', company?.id],
    enabled: Boolean(company),
    queryFn: async () => (await api.get<Risk[]>('/risks', { params: { company_id: company!.id } })).data,
  })

  return <Box>
    <Typography variant="h4">리스크 관리</Typography>
    <Typography color="text.secondary" sx={{ mt: .75, mb: 3 }}>업로드 자료 분석에서 실제로 생성된 리스크만 표시합니다.</Typography>
    <Card sx={cardSx}>
      <Box sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 760 }}>
        <TableHead><TableRow><TableCell>리스크 ID</TableCell><TableCell>분석 결과</TableCell><TableCell>분석 일시</TableCell><TableCell>분석 점수</TableCell><TableCell>심각도</TableCell><TableCell>상태</TableCell><TableCell>분석 경로</TableCell></TableRow></TableHead>
        <TableBody>
          {areCompaniesLoading || isLoading ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 8 }}><CircularProgress size={28} /></TableCell></TableRow> :
            data.length === 0 ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 8, color: 'text.secondary' }}>분석으로 생성된 리스크가 없습니다.</TableCell></TableRow> :
            data.map((risk) => <TableRow key={risk.id} hover>
              <TableCell><Typography component={Link} to={`/risks/${risk.id}`} sx={{ color: primary, fontWeight: 700, textDecoration: 'none' }}>{risk.risk_code || '-'}</Typography></TableCell>
              <TableCell><Typography component={Link} to={`/risks/${risk.id}`} sx={{ color: 'text.primary', fontWeight: 600, textDecoration: 'none' }}>{risk.title}</Typography><Typography color="text.secondary" fontSize={12} sx={{ mt: .5 }}>{risk.statement}</Typography></TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatAnalysisDate(risk.analyzed_at)}</TableCell><TableCell><SeverityPill value={risk.severity ?? risk.level} /></TableCell><TableCell>{risk.status}</TableCell><TableCell>{risk.route}</TableCell>
            </TableRow>)}
        </TableBody>
      </Table></Box>
      <Box sx={{ px: 2.5, py: 1.75, color: 'text.secondary', fontSize: 13 }}>현재 분석 결과 {data.length}건</Box>
    </Card>
  </Box>
}

function AnalysisInput({ lines, event, pkg }: { lines: JournalLine[]; event?: AccountingEvent; pkg?: Risk['package'] }) {
  const accounts = pkg?.related_accounts?.length ? pkg.related_accounts : [...new Set(lines.map((line) => line.account_name || line.account_code).filter(Boolean))]
  const voucherCount = pkg?.voucher_count ?? lines.length
  return <Card sx={cardSx}><CardContent sx={{ p: 2.5 }}>
    <SectionTitle>분석 입력 근거</SectionTitle>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,1fr)' }, gap: 2, mt: 2.25 }}>
      <Box><Typography sx={labelSx}>연결 이벤트</Typography><Typography sx={{ mt: .5, fontWeight: 700 }}>{event?.title || '-'}</Typography></Box>
      <Box><Typography sx={labelSx}>관련 계정</Typography><Typography sx={{ mt: .5, fontWeight: 700 }}>{accounts.join(', ') || '-'}</Typography></Box>
      <Box><Typography sx={labelSx}>원장 전표 수</Typography><Typography sx={{ mt: .5, fontWeight: 700 }}>{voucherCount}건</Typography></Box>
    </Box>
  </CardContent></Card>
}

export function RiskDetailPage() {
  const { riskId } = useParams()
  const { data: risk } = useQuery({ queryKey: ['risk', riskId], enabled: Boolean(riskId), queryFn: async () => (await api.get<RiskDetail>(`/risks/${riskId}`)).data })
  if (!risk) return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress size={30} /></Box>

  // Original ledger rows are the audit evidence. Never render the model's
  // paraphrased ledger evidence in their place.
  const pkg = { ...risk.package, ledger_evidence: risk.package.ledger_evidence?.filter(() => false) ?? [] }
  const lines = risk.journalLines ?? []
  const findings = risk.crossFindings ?? []
  const similarReviewCases = pkg?.review_similarity_cases ?? []
  return <Box>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
      <Box><Typography variant="h4">{risk.title}</Typography><Typography sx={{ ...labelSx, mt: .5 }}>리스크 ID · {risk.risk_code || '-'}</Typography><Stack direction="row" spacing={1} sx={{ mt: 1.25 }}><SeverityPill value={risk.severity ?? risk.level} /><Chip label={risk.status} size="small" /><Chip label={risk.route} size="small" /></Stack></Box>
    </Stack>
    <Stack spacing={3}>
      <RiskReviewDecisionCard risk={risk} />
      <AnalysisInput lines={lines} event={risk.event} pkg={pkg} />
      <Card sx={cardSx}><CardContent sx={{ p: 2.5 }}><SectionTitle>분석 결과</SectionTitle>
        <Typography sx={{ ...labelSx, mt: 2 }}>종합 판단</Typography>
        <Typography sx={{ mt: .5, color: 'text.secondary', lineHeight: 1.7 }}>{pkg?.summary || risk.statement}</Typography>
        <Typography sx={{ ...labelSx, mt: 2 }}>회계사건 추론</Typography>
        <Typography sx={{ mt: .5, lineHeight: 1.8 }}>{pkg?.event_inference || '-'}</Typography>
        <Typography sx={{ ...labelSx, mt: 2 }}>회계감사 이슈</Typography>
        <Stack spacing={1} sx={{ mt: .75 }}>{pkg?.audit_issues?.length ? pkg.audit_issues.map((item) => <Stack key={item} direction="row" spacing={1}><WarningAmberRoundedIcon color="warning" fontSize="small" /><Typography fontSize={14}>{item}</Typography></Stack>) : <Empty text="생성된 회계감사 이슈가 없습니다." />}</Stack>
        <Typography sx={{ ...labelSx, mt: 2.5 }}>권장 증빙</Typography>
        <Stack spacing={1.25} sx={{ mt: .75 }}>{pkg?.evidence_checklist?.length ? pkg.evidence_checklist.map((item) => <Stack key={item} direction="row" spacing={1}><CheckCircleOutlineRoundedIcon color="success" fontSize="small" /><Typography fontSize={14}>{item}</Typography></Stack>) : <Empty text="생성된 증빙 요청이 없습니다." />}</Stack>
      </CardContent></Card>
      <Card sx={cardSx}><CardContent sx={{ p: 2.5 }}><SectionTitle>검토 질문</SectionTitle><Stack spacing={1.25} sx={{ mt: 2 }}>{pkg?.expected_questions?.length ? pkg.expected_questions.map((item) => <Stack key={item} direction="row" spacing={1}><WarningAmberRoundedIcon color="warning" fontSize="small" /><Typography fontSize={14}>{item}</Typography></Stack>) : <Empty text="생성된 검토 질문이 없습니다." />}</Stack></CardContent></Card>
      <Card sx={cardSx}><CardContent sx={{ p: 2.5 }}><SectionTitle>기준서 검색 근거</SectionTitle><Stack spacing={1.25} sx={{ mt: 2 }}>{pkg?.standards_evidence?.length ? pkg.standards_evidence.map((reference, index) => <Alert key={`${reference.source}-${reference.title}-${index}`} severity="info"><Typography fontWeight={700}>{reference.source} · {reference.title}{reference.paragraph ? ` · ${reference.paragraph}` : ''}</Typography>{reference.excerpt && <Typography variant="body2" sx={{ mt: .5, whiteSpace: 'pre-wrap' }}>{reference.excerpt}</Typography>}{reference.url && <Typography component="a" href={reference.url} target="_blank" rel="noreferrer" variant="body2" sx={{ display: 'block', mt: .5, color: primary }}>{reference.url}</Typography>}</Alert>) : <Empty text="확인 가능한 기준서·질의문답·IFRIC 근거가 없습니다." />}</Stack></CardContent></Card>
      {similarReviewCases.length ? <Card sx={cardSx}><CardContent sx={{ p: 2.5 }}><SectionTitle>유사사례검색</SectionTitle><Stack spacing={1.25} sx={{ mt: 2 }}>{similarReviewCases.map((reviewCase) => <Alert key={reviewCase.riskCode} severity="info"><Typography fontWeight={700}>유사 클리어 검토 사례 · {Math.round(reviewCase.similarity * 100)}%</Typography><Typography component={Link} to={`/risk-reviews/${encodeURIComponent(reviewCase.riskCode)}`} sx={{ display: 'block', mt: .5, color: primary, fontWeight: 700, textDecoration: 'none' }}>{reviewCase.riskCode} · {reviewCase.title}</Typography><Typography variant="body2" sx={{ mt: .5 }}>검토 분류 {reviewCase.reviewDecision} · 심각도 {reviewCase.severity}</Typography></Alert>)}</Stack></CardContent></Card> : null}
      <Card sx={cardSx}><CardContent sx={{ p: 2.5 }}><SectionTitle>원장 근거</SectionTitle><Table size="small" sx={{ mt: 2 }}><TableHead><TableRow><TableCell>전표</TableCell><TableCell>계정</TableCell><TableCell>전기일</TableCell><TableCell>차대변</TableCell><TableCell align="right">금액</TableCell><TableCell>적요</TableCell></TableRow></TableHead><TableBody>{lines.length ? lines.map((line) => <TableRow key={line.id}><TableCell>{line.document_number || '-'}</TableCell><TableCell>{line.account_name || line.account_code || '-'}</TableCell><TableCell>{line.posting_date || '-'}</TableCell><TableCell>{line.debit_credit_indicator || '-'}</TableCell><TableCell align="right">{Number(line.local_amount || 0).toLocaleString()}</TableCell><TableCell>{line.header_text || line.line_text || '-'}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} align="center">연결된 원장 행이 없습니다.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
    </Stack>
  </Box>
}
