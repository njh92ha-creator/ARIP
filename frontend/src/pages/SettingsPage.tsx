import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  InputAdornment,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import {
  AccountBalanceOutlined,
  AutoGraphOutlined,
  CloudUploadOutlined,
  DescriptionOutlined,
  LockOutlined,
  PsychologyOutlined,
  SettingsSuggestOutlined,
  TuneOutlined,
} from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, Company } from '../api'

const sectionHeaderSx = { p: 2.5, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }
const cardContentSx = { p: 2.5, '&:last-child': { pb: 2.5 } }

export function SettingsPage() {
  const [tab, setTab] = useState(0)
  const queryClient = useQueryClient()
  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get<Company[]>('/companies')).data,
  })
  const createCompany = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const data = new FormData(form)
      return (await api.post('/companies', {
        company_code: data.get('company_code'),
        company_name: data.get('company_name'),
        industry: data.get('industry'),
        functional_currency: data.get('functional_currency'),
        fiscal_year_start_month: Number(data.get('fiscal_year_start_month')),
        close_frequency: 'MONTHLY',
        month_close_day: Number(data.get('month_close_day')),
      })).data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  })
  const company = companies.data?.[0]

  return (
    <Box sx={{ maxWidth: 1720, mx: 'auto' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">설정</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
          회사별 결산 분석 준비 상태와 운영 기준을 관리합니다.
        </Typography>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider', '& .MuiTab-root': { minHeight: 52, px: 2.25, textTransform: 'none', fontWeight: 600 } }}
      >
        <Tab icon={<AccountBalanceOutlined fontSize="small" />} iconPosition="start" label="회사 및 회계연도" />
        <Tab icon={<TuneOutlined fontSize="small" />} iconPosition="start" label="감사 중요성" />
        <Tab icon={<AutoGraphOutlined fontSize="small" />} iconPosition="start" label="계정 증감(AVI)" />
        <Tab icon={<PsychologyOutlined fontSize="small" />} iconPosition="start" label="AI 및 지식베이스" />
      </Tabs>

      {tab === 0 && <CompanySettings company={company} createCompany={createCompany} />}
      {tab === 1 && <MaterialitySettings company={company} />}
      {tab === 2 && <VarianceSettings company={company} />}
      {tab === 3 && <Stack spacing={3}><AiSettings /><KnowledgeSettingsV2 company={company} /></Stack>}
    </Box>
  )
}

function CompanySettings({ company, createCompany }: {
  company?: Company
  createCompany: { mutate: (form: HTMLFormElement) => void; isPending: boolean; isError: boolean }
}) {
  return <Stack spacing={2.5}>
    <Card>
      <Box sx={sectionHeaderSx}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
          <Box>
            <Typography variant="h6">회사 기본 정보</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>결산 분석에 사용할 회사와 회계연도 정보를 등록합니다.</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button type="reset" form="company-settings-form" variant="outlined">초기화</Button>
            <Button type="submit" form="company-settings-form" variant="contained" disabled={createCompany.isPending}>저장</Button>
          </Stack>
        </Stack>
      </Box>
      <CardContent sx={cardContentSx}>
        {company && <Alert severity="success" sx={{ mb: 2.5 }}>{company.company_name} · {company.industry} 회사 정보가 등록되어 있습니다.</Alert>}
        {createCompany.isError && <Alert severity="error" sx={{ mb: 2.5 }}>회사 정보 저장에 실패했습니다. 입력값과 연결 상태를 확인해 주세요.</Alert>}
        <Box id="company-settings-form" component="form" onSubmit={(event) => { event.preventDefault(); createCompany.mutate(event.currentTarget) }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}><TextField name="company_code" label="회사 코드" placeholder="예: ARIP01" required fullWidth /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField name="company_name" label="회사명" placeholder="예: (주)ARIP 전자" required fullWidth /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField name="industry" label="업종" placeholder="예: 제조업" required fullWidth /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField name="functional_currency" label="기능통화" defaultValue="KRW" required fullWidth helperText="결산 분석에 적용할 기준 통화입니다." /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField name="fiscal_year_start_month" type="number" label="회계연도 시작월" defaultValue="1" required fullWidth InputProps={{ endAdornment: <InputAdornment position="end">월</InputAdornment> }} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField name="month_close_day" type="number" label="월 마감일" defaultValue="5" required fullWidth InputProps={{ endAdornment: <InputAdornment position="end">일</InputAdornment> }} /></Grid>
          </Grid>
        </Box>
      </CardContent>
    </Card>
    <Card>
      <CardContent sx={cardContentSx}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2.5}>
          <Box><Typography variant="h6">등록 회사 현황</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>분석 시작 전 회사별 준비 상태를 확인하세요.</Typography></Box>
          <TextField size="small" placeholder="회사 코드 또는 회사명 검색" sx={{ minWidth: { md: 280 } }} />
        </Stack>
        <Grid container spacing={1.5} sx={{ mt: 2.5 }}>
          <ReadinessTile label="전체 등록 회사" value={companiesLabel(company)} />
          <ReadinessTile label="분석 가능" value={company ? '1' : '0'} tone="success.main" />
          <ReadinessTile label="설정 미완료" value="0" tone="warning.main" />
          <ReadinessTile label="비활성" value="0" tone="text.disabled" />
        </Grid>
      </CardContent>
    </Card>
  </Stack>
}

function companiesLabel(company?: Company) { return company ? '1' : '0' }

function ReadinessTile({ label, value, tone = 'primary.main' }: { label: string; value: string; tone?: string }) {
  return <Grid size={{ xs: 6, md: 3 }}><Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default' }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography sx={{ fontSize: 28, fontWeight: 700, color: tone, mt: 0.5 }}>{value}</Typography></Box></Grid>
}

function MaterialitySettings({ company }: { company?: Company }) {
  const [message, setMessage] = useState('')
  if (!company) return <Alert severity="info">먼저 회사 및 회계연도 탭에서 회사를 등록해 주세요.</Alert>
  return <Grid container spacing={2.5}>
    <Grid size={{ xs: 12, lg: 8 }}><Card>
      <Box sx={sectionHeaderSx}><Typography variant="h6">감사 중요성 기준</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>감사 리스크 판단에 적용할 중요성 기준을 설정합니다.</Typography></Box>
      <CardContent sx={cardContentSx}>
        <Box component="form" onSubmit={async (e) => {
          e.preventDefault(); const d = new FormData(e.currentTarget)
          await api.post('/settings/materiality', {
            company_id: company.id, name: '기본 중요성', benchmark: d.get('benchmark'),
            overall_materiality: d.get('overall'), performance_materiality: d.get('performance'),
            trivial_threshold: d.get('trivial'), effective_from: d.get('effective_from'), approve: true,
          }); setMessage('중요성 기준이 승인된 상태로 저장되었습니다.')
        }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}><TextField name="benchmark" label="벤치마크" defaultValue="TOTAL_ASSETS" select fullWidth><MenuItem value="TOTAL_ASSETS">총자산</MenuItem><MenuItem value="REVENUE">매출액</MenuItem><MenuItem value="EQUITY">자본총계</MenuItem></TextField></Grid>
            <Grid size={{ xs: 12, md: 6 }}><TextField name="effective_from" label="적용 시작일" type="date" defaultValue="2026-01-01" fullWidth slotProps={{ inputLabel: { shrink: true } }} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField name="overall" label="전체 중요성" type="number" fullWidth helperText="예: 500,000,000원" /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField name="performance" label="수행 중요성" type="number" fullWidth helperText="예: 300,000,000원" /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField name="trivial" label="사소한 금액 기준" type="number" fullWidth helperText="예: 10,000,000원" /></Grid>
          </Grid>
          <Button type="submit" variant="contained" sx={{ mt: 2.5 }}>검토 및 저장</Button>
        </Box>
        {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
      </CardContent>
    </Card></Grid>
    <Grid size={{ xs: 12, lg: 4 }}><Card sx={{ height: '100%' }}><CardContent sx={cardContentSx}>
      <Typography variant="h6">저장 전 미리보기</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 2.5 }}>금액을 입력하면 승인 시 정규화된 원화 금액으로 기록됩니다.</Typography>
      <Stack spacing={1.75} divider={<Divider flexItem />}><Fact label="기준 회사" value={company.company_name} /><Fact label="전체 중요성" value="입력 전" /><Fact label="수행 중요성" value="입력 전" /><Fact label="적용 기간" value="2026-01-01부터" /></Stack>
    </CardContent></Card></Grid>
  </Grid>
}

function VarianceSettings({ company }: { company?: Company }) {
  const [message, setMessage] = useState('')
  if (!company) return <Alert severity="info">먼저 회사 및 회계연도 탭에서 회사를 등록해 주세요.</Alert>
  return <Stack spacing={2.5}>
    <Alert severity="info" icon={<AutoGraphOutlined fontSize="inherit" />} sx={{ border: '1px solid #BFDBFE', bgcolor: '#EFF6FF', color: '#124F9E' }}>
      AVI 관측치는 증감 원인을 확인하기 위한 정량 신호입니다. 담당자가 명시적으로 연결하기 전에는 Audit Risk로 자동 생성되지 않습니다.
    </Alert>
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12, lg: 7 }}><Card>
        <Box sx={sectionHeaderSx}><Typography variant="h6">계정 증감 기준 (AVI)</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>전월 대비와 전년 동월 대비 기준을 함께 저장합니다.</Typography></Box>
        <CardContent sx={cardContentSx}>
          <Box component="form" onSubmit={async (e) => {
            e.preventDefault(); const d = new FormData(e.currentTarget)
            const common = { amount_threshold: d.get('amount'), rate_threshold: Number(d.get('rate')) / 100, minimum_base_amount: d.get('minimum'), trigger_mode: d.get('mode') }
            await api.post('/variance-settings/profiles', { company_id: company.id, name: '기본 AVI', approve: true, thresholds: [{ comparison: 'MOM', ...common }, { comparison: 'YOY', ...common }] })
            setMessage('AVI 기준이 승인된 상태로 저장되었습니다.')
          }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}><TextField label="기준 회사" value={company.company_name} fullWidth slotProps={{ input: { readOnly: true } }} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField label="적용 기준" value="전월 대비(MoM) · 전년 동월 대비(YoY)" fullWidth slotProps={{ input: { readOnly: true } }} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField name="amount" label="증감 금액 기준" type="number" fullWidth InputProps={{ endAdornment: <InputAdornment position="end">KRW</InputAdornment> }} helperText="예: 500,000,000원" /></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField name="rate" label="증감률 기준" type="number" fullWidth InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} helperText="0~1,000% 범위로 입력합니다." /></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField name="minimum" label="최소 비교 금액" type="number" fullWidth InputProps={{ endAdornment: <InputAdornment position="end">KRW</InputAdornment> }} helperText="해당 금액 미만의 잔액은 분석 대상에서 제외합니다." /></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField name="mode" label="Trigger 방식" select defaultValue="ANY" fullWidth><MenuItem value="ANY">하나 이상 충족 (OR)</MenuItem><MenuItem value="ALL">모두 충족 (AND)</MenuItem></TextField></Grid>
            </Grid>
            <Button type="submit" variant="contained" sx={{ mt: 2.5 }}>설정 적용</Button>
          </Box>
          {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
        </CardContent>
      </Card></Grid>
      <Grid size={{ xs: 12, lg: 5 }}><Stack spacing={2.5}>
        <Card><Box sx={sectionHeaderSx}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6">계정별 예외 기준</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>특수 계정에는 개별 임계치를 적용할 수 있습니다.</Typography></Box><Button variant="outlined" size="small" disabled>예외 기준 추가</Button></Stack></Box><CardContent sx={cardContentSx}><Typography variant="body2" color="text.secondary">등록된 계정별 예외 기준이 없습니다.</Typography></CardContent></Card>
        <Card><CardContent sx={cardContentSx}><Typography variant="h6">적용 결과 미리보기</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>저장된 기준으로 감지된 관측치만 AVI 목록에 표시됩니다.</Typography><Chip label="Audit Risk 자동 생성 없음" size="small" variant="outlined" sx={{ mt: 2, color: 'text.secondary' }} /></CardContent></Card>
      </Stack></Grid>
    </Grid>
  </Stack>
}

function AiSettings() {
  const [result, setResult] = useState('')
  return <Card>
    <Box sx={sectionHeaderSx}><Stack direction="row" spacing={1} alignItems="center"><Typography variant="h6">AI 연결 설정</Typography><Chip icon={<LockOutlined />} label="시스템 관리자 전용" size="small" variant="outlined" /></Stack><Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>OpenAI 연결이 없어도 기존 규칙과 템플릿 기반 분석은 계속 실행됩니다.</Typography></Box>
    <CardContent sx={cardContentSx}><Grid container spacing={3}>
      <Grid size={{ xs: 12, lg: 7 }}><Box component="form" onSubmit={async (e) => {
        e.preventDefault(); const d = new FormData(e.currentTarget)
        const response = await api.patch('/settings/ai-connection', { provider: 'openai', chat_model: d.get('model'), embedding_model: 'text-embedding-3-large', secret_reference: d.get('secret_reference'), enabled: d.get('enabled') === 'true' })
        setResult(JSON.stringify(response.data)); e.currentTarget.reset()
      }}><Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}><TextField label="Provider" value="OpenAI" fullWidth slotProps={{ input: { readOnly: true } }} /></Grid>
        <Grid size={{ xs: 12, md: 6 }}><TextField name="model" label="Chat 모델" placeholder="예: gpt-4o-mini" fullWidth /></Grid>
        <Grid size={{ xs: 12, md: 6 }}><TextField label="Embedding 모델" value="text-embedding-3-large" fullWidth slotProps={{ input: { readOnly: true } }} /></Grid>
        <Grid size={{ xs: 12, md: 6 }}><TextField name="enabled" label="AI 기능 상태" select defaultValue="false" fullWidth><MenuItem value="false">비활성</MenuItem><MenuItem value="true">활성</MenuItem></TextField></Grid>
        <Grid size={12}><TextField name="secret_reference" type="password" autoComplete="new-password" label="OpenAI API 키" placeholder="새 API 키 입력" fullWidth helperText="보안을 위해 입력 시에만 노출되며, 저장 후에는 다시 표시하지 않습니다." /></Grid>
      </Grid><Stack direction="row" spacing={1} sx={{ mt: 2.5 }}><Button type="button" variant="outlined">연결 테스트</Button><Button type="submit" variant="contained">저장</Button></Stack></Box></Grid>
      <Grid size={{ xs: 12, lg: 5 }}><Box sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', height: '100%' }}><Typography variant="subtitle1" fontWeight={700}>연결 상태</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>저장된 키와 응답 내용은 화면에 표시하거나 감사 로그에 기록하지 않습니다.</Typography><Stack spacing={1.5} sx={{ mt: 2.5 }}><Fact label="현재 상태" value="미설정" /><Fact label="모델" value="저장 후 표시" /><Fact label="마지막 검증" value="검증 전" /></Stack></Box></Grid>
    </Grid>{result && <Alert severity="success" sx={{ mt: 2.5 }}>비밀값을 노출하지 않고 연결 설정을 저장했습니다.</Alert>}</CardContent>
  </Card>
}

function KnowledgeSettingsV2({ company }: { company?: Company }) {
  const [rootDirectory, setRootDirectory] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)
  const runtime = useQuery({ queryKey: ['runtime-settings-v2'], queryFn: async () => (await api.get('/settings/runtime')).data })
  useEffect(() => { const source = runtime.data?.knowledgeSources?.find((item: { company_id?: string }) => item.company_id === company?.id); if (source?.root_directory) setRootDirectory(String(source.root_directory)) }, [runtime.data, company?.id])
  if (!company) return <Alert severity="info">먼저 회사 및 회계연도 탭에서 회사를 등록해 주세요.</Alert>
  const savePath = async () => { setError(''); setMessage(''); try { const response = await api.patch('/settings/knowledge-sources/local-standards', { company_id: company.id, root_directory: rootDirectory }); setRootDirectory(response.data.root_directory); setMessage('경로가 저장되었습니다.'); await runtime.refetch() } catch { setError('경로 저장에 실패했습니다. 백엔드 연결과 권한을 확인해 주세요.') } }
  const uploadFiles = async () => { if (!selectedFiles?.length) return; setError(''); setMessage(''); try { const form = new FormData(); Array.from(selectedFiles).forEach((file) => form.append('files', file)); const response = await api.post('/settings/knowledge-sources/local-standards/upload', form, { params: { company_id: company.id } }); setMessage(`${response.data.uploaded}개 파일을 업로드하고 확인 대기(PENDING)로 등록했습니다.`) } catch { setError('파일 업로드에 실패했습니다. 백엔드 로그를 확인해 주세요.') } }
  const scanFolder = async () => { setError(''); setMessage(''); try { const response = await api.post('/settings/knowledge-sources/local-standards/scan', null, { params: { company_id: company.id } }); setMessage(`${response.data.scanned}개 파일을 확인 대기(PENDING)로 등록했습니다.`) } catch { setError('폴더 스캔에 실패했습니다. Windows 경로는 Docker에서 직접 스캔할 수 없으므로 파일 업로드를 사용해 주세요.') } }
  return <Card><Box sx={sectionHeaderSx}><Stack direction="row" spacing={1} alignItems="center"><Typography variant="h6">기준서 및 지식베이스</Typography><Chip icon={<DescriptionOutlined />} label="RAG" size="small" variant="outlined" /></Stack><Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>승인된 문서만 AI 검색과 응답의 근거로 사용됩니다.</Typography></Box><CardContent sx={cardContentSx}>
    <Grid container spacing={2.5}><Grid size={{ xs: 12, lg: 7 }}><Box sx={{ p: { xs: 2.5, sm: 4 }, border: '2px dashed', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default', textAlign: 'center' }}><CloudUploadOutlined color="primary" sx={{ fontSize: 34 }} /><Typography fontWeight={700} sx={{ mt: 1 }}>기준서 또는 내부 회계정책 업로드</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>PDF, HWP, HWPX, DOCX, TXT, MD, HTML 형식을 지원합니다.</Typography><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" alignItems="center" spacing={1.25} sx={{ mt: 2.25 }}><Button component="label" variant="outlined">파일 선택<input type="file" hidden multiple accept=".pdf,.hwp,.hwpx,.docx,.txt,.md,.html" onChange={(event) => setSelectedFiles(event.target.files)} /></Button><Button variant="contained" disabled={!selectedFiles?.length} onClick={uploadFiles}>업로드</Button></Stack>{selectedFiles?.length ? <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>{selectedFiles.length}개 파일 선택됨</Typography> : null}</Box></Grid>
      <Grid size={{ xs: 12, lg: 5 }}><Stack spacing={1.5}><TextField label="컨테이너 내부 기준서 폴더 (선택)" value={rootDirectory} onChange={(event) => setRootDirectory(event.target.value)} fullWidth helperText="예: /app/data/standards. Windows 경로는 파일 업로드를 사용하세요." /><Stack direction="row" spacing={1}><Button variant="outlined" disabled={!rootDirectory.trim()} onClick={savePath}>경로 저장</Button><Button variant="outlined" disabled={!rootDirectory.trim()} onClick={scanFolder}>폴더 스캔</Button></Stack></Stack></Grid></Grid>
    {message && <Alert severity="success" sx={{ mt: 2.5 }}>{message}</Alert>}{error && <Alert severity="error" sx={{ mt: 2.5 }}>{error}</Alert>}
  </CardContent></Card>
}

function Fact({ label, value }: { label: string; value: string }) { return <Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="body2" fontWeight={600} sx={{ mt: 0.25 }}>{value}</Typography></Box> }
