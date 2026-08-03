import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api, Company, Risk } from '../api'
import { StatusBadge } from '../components/StatusBadge'

const cardSx = { borderColor: '#E5E7EB', borderRadius: 3, boxShadow: 'none' }
const mutedLabelSx = { color: 'text.secondary', fontSize: 12, fontWeight: 700, letterSpacing: '0.02em' }

function DetailMetric({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <Box sx={{ p: 2, minWidth: 0, borderRight: { md: '1px solid #E5E7EB' }, '&:last-child': { borderRight: 0 } }}>
      <Typography sx={mutedLabelSx}>{label}</Typography>
      <Box sx={{ mt: 0.75, color: accent ? 'primary.main' : 'text.primary', fontWeight: 700 }}>{value}</Box>
    </Box>
  )
}

function PackageList({ title, items, tone = 'default' }: { title: string; items?: string[]; tone?: 'default' | 'warning' }) {
  return (
    <Card sx={{ ...cardSx, height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography variant="h6" sx={{ fontSize: 16 }}>{title}</Typography>
        <List dense disablePadding sx={{ mt: 1.25 }}>
          {(items?.length ? items : ['등록된 내용이 없습니다.']).map((item) => (
            <ListItem key={item} disableGutters sx={{ alignItems: 'flex-start', py: 0.5 }}>
              <Box sx={{ mt: 0.85, mr: 1, width: 6, height: 6, borderRadius: '50%', flex: '0 0 auto', bgcolor: tone === 'warning' ? 'warning.main' : 'primary.main' }} />
              <ListItemText primary={item} primaryTypographyProps={{ fontSize: 14, lineHeight: 1.55, color: 'text.secondary' }} />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  )
}

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
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2.5} sx={{ mb: 3 }}>
        <Box>
          <Typography sx={{ color: 'text.secondary', fontSize: 13, mb: 0.75 }}>홈　›　리스크 관리</Typography>
          <Typography variant="h4">리스크 관리</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            AI 및 규칙 기반 분석 결과입니다. 최종 판단과 조치는 담당자의 검토가 필요합니다.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} alignSelf={{ xs: 'flex-start', md: 'flex-end' }}>
          <Button variant="outlined" startIcon={<DownloadRoundedIcon />} sx={{ borderColor: '#E5E7EB', color: 'text.primary' }}>엑셀 다운로드</Button>
          <Button variant="contained" startIcon={<AddRoundedIcon />}>새 리스크 등록</Button>
        </Stack>
      </Stack>

      <Card sx={{ ...cardSx, mb: 3 }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: '1.1fr 1.15fr 1.25fr 1.15fr 2fr' }, gap: 2 }}>
            <TextField label="결산기간" value="현재 회사" InputProps={{ readOnly: true }} size="small" />
            <FormControl size="small"><InputLabel>리스크 유형</InputLabel><Select label="리스크 유형" value="all"><MenuItem value="all">전체 유형</MenuItem></Select></FormControl>
            <Box><Typography sx={{ ...mutedLabelSx, mb: 0.6 }}>심각도</Typography><Stack direction="row" spacing={0.5}><Chip label="High" size="small" color="error" variant="outlined" /><Chip label="Medium" size="small" /><Chip label="Low" size="small" /></Stack></Box>
            <FormControl size="small"><InputLabel>상태</InputLabel><Select label="상태" value="all"><MenuItem value="all">전체 상태</MenuItem></Select></FormControl>
            <TextField label="검색" placeholder="리스크 ID, 제목 검색" size="small" InputProps={{ startAdornment: <SearchRoundedIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }} />
          </Box>
          <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 2.5 }}>
            <Typography sx={mutedLabelSx}>전체 결과</Typography><Typography sx={{ color: 'primary.main', fontSize: 28, fontWeight: 700 }}>{data.length}</Typography><Typography color="text.secondary">건</Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ ...cardSx, overflow: 'hidden' }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 860 }}>
            <TableHead><TableRow>
              <TableCell>리스크 ID</TableCell><TableCell>제목</TableCell><TableCell align="right">점수</TableCell><TableCell>심각도</TableCell><TableCell>상태</TableCell><TableCell>분석 경로</TableCell><TableCell>중요성</TableCell>
            </TableRow></TableHead>
            <TableBody>{data.map((risk) => (
              <TableRow key={risk.id} hover sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}><Link to={`/risks/${risk.id}`}>{risk.id}</Link></TableCell>
                <TableCell sx={{ minWidth: 260 }}><Link to={`/risks/${risk.id}`} style={{ color: 'inherit', fontWeight: 600 }}>{risk.title}</Link></TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{Number(risk.score).toLocaleString()}</TableCell>
                <TableCell><StatusBadge value={risk.level} /></TableCell><TableCell><StatusBadge value={risk.status} /></TableCell>
                <TableCell>{risk.route}</TableCell><TableCell>{risk.materiality_level}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </Box>
        <Box sx={{ px: 2.5, py: 1.75, borderTop: '1px solid #E5E7EB', color: 'text.secondary', fontSize: 14 }}>표시 결과: {data.length}건</Box>
      </Card>

      <Alert icon={<AutoAwesomeRoundedIcon fontSize="inherit" />} severity="info" variant="outlined" sx={{ mt: 3, borderColor: '#BFDBFE', bgcolor: '#F8FBFF', alignItems: 'center' }}>
        <Typography component="span" fontWeight={700}>AI 분석 요약</Typography>　현재 목록은 분석 우선순위를 보여 줍니다. 증빙과 회계 기준을 확인한 뒤 담당자가 최종 검토해야 합니다.
      </Alert>
    </Box>
  )
}

export function RiskDetailPage() {
  const { riskId } = useParams()
  const { data: risk } = useQuery({
    queryKey: ['risk', riskId],
    enabled: Boolean(riskId),
    queryFn: async () => (await api.get<Risk & { memory: unknown[]; crossFindings: Array<{ id: string; title: string; statement: string; finding_type: string }> }>(`/risks/${riskId}`)).data,
  })
  if (!risk) return <Typography>리스크 정보를 불러오는 중입니다.</Typography>

  const packageData = risk.package
  return (
    <Box>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2.5} sx={{ mb: 3 }}>
        <Box>
          <Button component={Link} to="/risks" size="small" startIcon={<ArrowBackRoundedIcon />} sx={{ mb: 1, px: 0, color: 'text.secondary' }}>리스크 관리로 돌아가기</Button>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap><Typography variant="h4">{risk.title}</Typography><StatusBadge value={risk.level} /><StatusBadge value={risk.status} /></Stack>
        </Box>
        <Stack direction="row" spacing={1.25} alignSelf={{ xs: 'flex-start', lg: 'flex-end' }}>
          <Button variant="outlined" sx={{ borderColor: '#E5E7EB', color: 'text.primary' }}>리스크 편집</Button>
          <Button variant="outlined" sx={{ borderColor: '#E5E7EB', color: 'text.primary' }}>Risk Package</Button>
          <Button variant="contained">검토 시작</Button>
        </Stack>
      </Stack>

      <Card sx={{ ...cardSx, mb: 3 }}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' } }}>
        <DetailMetric label="리스크 ID" value={risk.id} accent />
        <DetailMetric label="총 리스크 점수" value={Number(risk.score).toLocaleString()} />
        <DetailMetric label="중요성" value={risk.materiality_level} />
        <DetailMetric label="분석 경로" value={risk.route} />
      </Box></Card>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 8fr) minmax(290px, 4fr)' }, gap: 3 }}>
        <Stack spacing={3}>
          <Card sx={cardSx}><CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
            <Typography variant="h6">회계 이슈 상세</Typography><Divider sx={{ my: 2 }} />
            <Typography sx={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{risk.statement}</Typography>
            <Alert severity="info" variant="outlined" sx={{ mt: 2.5, bgcolor: '#F8FBFF' }}>AI가 식별한 위험 신호는 검토 보조 정보입니다. 최종 판단 전 관련 회계 기준과 원천 증빙을 반드시 확인하세요.</Alert>
          </CardContent></Card>

          {(risk.crossFindings?.length ?? 0) > 0 && <Card sx={cardSx}><CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
            <Typography variant="h6">결산 세트 교차 분석 신호</Typography><Divider sx={{ my: 2 }} />
            <List disablePadding>{risk.crossFindings.map((finding) => <ListItem key={finding.id} disableGutters sx={{ alignItems: 'flex-start' }}><ListItemText primary={finding.title} secondary={finding.statement} primaryTypographyProps={{ fontWeight: 700 }} secondaryTypographyProps={{ sx: { mt: 0.5, lineHeight: 1.55 } }} /></ListItem>)}</List>
          </CardContent></Card>}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
            <PackageList title="예상 감사 질문" items={packageData?.expected_questions} />
            <PackageList title="필요 증빙" items={packageData?.evidence_checklist} tone="warning" />
            <PackageList title="대응 방안" items={packageData?.response_guidance} />
            <Card sx={{ ...cardSx, height: '100%' }}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}><Typography variant="h6" sx={{ fontSize: 16 }}>참조 기준 및 사례</Typography><List dense disablePadding sx={{ mt: 1.25 }}>{packageData?.references?.map((reference, index) => <ListItem key={`${reference.type}-${reference.code}-${index}`} disableGutters><ListItemText primary={`${reference.type ?? '참조'} ${reference.code ?? ''}`} secondary={reference.status} primaryTypographyProps={{ fontSize: 14, fontWeight: 700 }} secondaryTypographyProps={{ fontSize: 12 }} /></ListItem>)}</List></CardContent></Card>
          </Box>
        </Stack>

        <Stack spacing={3}>
          <Card sx={{ ...cardSx, bgcolor: '#F1F7FF', borderColor: '#BFDBFE' }}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Stack direction="row" alignItems="center" spacing={1}><AutoAwesomeRoundedIcon color="primary" /><Typography variant="h6">지능형 통찰</Typography></Stack><Divider sx={{ my: 2 }} />
            <Typography color="text.secondary" sx={{ lineHeight: 1.65 }}>{packageData?.summary || '분석 요약이 아직 생성되지 않았습니다.'}</Typography>
            <Typography sx={{ mt: 2, fontSize: 12, color: 'text.secondary' }}>AI 분석 결과는 사람의 검토와 승인 없이 확정 결론으로 사용될 수 없습니다.</Typography>
          </CardContent></Card>

          {packageData?.evidence_status === 'EVIDENCE_ENRICHMENT_REQUIRED' && <Alert severity="warning" variant="outlined"><Typography fontWeight={700}>근거 보강 필요</Typography><Typography variant="body2" sx={{ mt: 0.5 }}>다음 사실관계와 원천 증빙을 보강한 뒤 최종 검토하세요.</Typography><List dense>{packageData.missing_facts.map((fact) => <ListItem key={fact} disableGutters><ListItemText primary={fact} /></ListItem>)}</List></Alert>}
          {packageData?.references?.some((reference) => reference.status === 'REFERENCE_REQUIRED') && <Alert severity="warning" variant="outlined">확인 전 지식 문단과 연결된 Package는 최종 확정할 수 없습니다.</Alert>}
        </Stack>
      </Box>
    </Box>
  )
}
