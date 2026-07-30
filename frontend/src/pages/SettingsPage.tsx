import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, Company } from '../api'

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
      return (
        await api.post('/companies', {
          company_code: data.get('company_code'),
          company_name: data.get('company_name'),
          industry: data.get('industry'),
          functional_currency: data.get('functional_currency'),
          fiscal_year_start_month: Number(data.get('fiscal_year_start_month')),
          close_frequency: 'MONTHLY',
          month_close_day: Number(data.get('month_close_day')),
        })
      ).data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  })
  const company = companies.data?.[0]
  return (
    <Box>
      <Typography variant="h4">Settings</Typography>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ my: 2 }}>
        <Tab label="회사·회계연도" /><Tab label="중요성·AVI" /><Tab label="AI·RAG" /><Tab label="Knowledge Sources" />
      </Tabs>
      {tab === 0 && (
        <Card><CardContent>
          <Typography variant="h6">회사 기본정보</Typography>
          {company && <Alert severity="success" sx={{ my: 2 }}>{company.company_name} ({company.industry}) 설정됨</Alert>}
          <Box component="form" onSubmit={(event) => { event.preventDefault(); createCompany.mutate(event.currentTarget) }} sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}><TextField name="company_code" label="회사코드" required fullWidth /></Grid>
              <Grid size={{ xs: 12, md: 4 }}><TextField name="company_name" label="회사명" required fullWidth /></Grid>
              <Grid size={{ xs: 12, md: 4 }}><TextField name="industry" label="업종" required fullWidth /></Grid>
              <Grid size={{ xs: 12, md: 4 }}><TextField name="functional_currency" label="기능통화" defaultValue="KRW" required fullWidth /></Grid>
              <Grid size={{ xs: 12, md: 4 }}><TextField name="fiscal_year_start_month" type="number" label="회계연도 시작월" defaultValue="1" required fullWidth /></Grid>
              <Grid size={{ xs: 12, md: 4 }}><TextField name="month_close_day" type="number" label="월 마감일" defaultValue="5" required fullWidth /></Grid>
            </Grid>
            <Button type="submit" variant="contained" sx={{ mt: 2 }}>저장</Button>
          </Box>
        </CardContent></Card>
      )}
      {tab === 1 && <MaterialitySettings company={company} />}
      {tab === 2 && <AiSettings />}
      {tab === 3 && <KnowledgeSettingsV2 company={company} />}
    </Box>
  )
}

function MaterialitySettings({ company }: { company?: Company }) {
  const [message, setMessage] = useState('')
  if (!company) return <Alert severity="info">회사를 먼저 등록해 주세요.</Alert>
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, lg: 6 }}><Card><CardContent>
        <Typography variant="h6">Audit Risk 중요성</Typography>
        <Box component="form" onSubmit={async (e) => {
          e.preventDefault(); const d = new FormData(e.currentTarget)
          await api.post('/settings/materiality', {
            company_id: company.id, name: '기본 중요성', benchmark: d.get('benchmark'),
            overall_materiality: d.get('overall'), performance_materiality: d.get('performance'),
            trivial_threshold: d.get('trivial'), effective_from: d.get('effective_from'), approve: true,
          }); setMessage('중요성 Profile이 승인 저장되었습니다.')
        }}>
          <TextField name="benchmark" label="Benchmark" defaultValue="TOTAL_ASSETS" fullWidth sx={{ mt: 2 }} />
          <TextField name="overall" label="Overall Materiality" type="number" fullWidth sx={{ mt: 2 }} />
          <TextField name="performance" label="Performance Materiality" type="number" fullWidth sx={{ mt: 2 }} />
          <TextField name="trivial" label="Trivial Threshold" type="number" fullWidth sx={{ mt: 2 }} />
          <TextField name="effective_from" label="적용 시작일" type="date" defaultValue="2026-01-01" fullWidth sx={{ mt: 2 }} slotProps={{ inputLabel: { shrink: true } }} />
          <Button type="submit" variant="contained" sx={{ mt: 2 }}>승인 저장</Button>
        </Box>
      </CardContent></Card></Grid>
      <Grid size={{ xs: 12, lg: 6 }}><Card><CardContent>
        <Typography variant="h6">Account Variance 기준</Typography>
        <Box component="form" onSubmit={async (e) => {
          e.preventDefault(); const d = new FormData(e.currentTarget)
          const common = { amount_threshold: d.get('amount'), rate_threshold: Number(d.get('rate')) / 100, minimum_base_amount: d.get('minimum'), trigger_mode: d.get('mode') }
          await api.post('/variance-settings/profiles', { company_id: company.id, name: '기본 AVI', approve: true, thresholds: [{ comparison: 'MOM', ...common }, { comparison: 'YOY', ...common }] })
          setMessage('AVI Profile이 승인 저장되었습니다.')
        }}>
          <TextField name="amount" label="증감액 기준" type="number" fullWidth sx={{ mt: 2 }} />
          <TextField name="rate" label="증감률 기준(%)" type="number" fullWidth sx={{ mt: 2 }} />
          <TextField name="minimum" label="최소 비교기준금액" type="number" fullWidth sx={{ mt: 2 }} />
          <TextField name="mode" label="Trigger" select defaultValue="ANY" fullWidth sx={{ mt: 2 }}><MenuItem value="ANY">ANY</MenuItem><MenuItem value="ALL">ALL</MenuItem></TextField>
          <Button type="submit" variant="contained" sx={{ mt: 2 }}>승인 저장</Button>
        </Box>
      </CardContent></Card></Grid>
      {message && <Grid size={12}><Alert severity="success">{message}</Alert></Grid>}
    </Grid>
  )
}

function AiSettings() {
  const [result, setResult] = useState('')
  return <Card><CardContent>
    <Typography variant="h6">AI 연결</Typography>
    <Alert severity="info" sx={{ my: 2 }}>API 키 원문은 저장하지 않습니다. Secret 참조만 등록합니다.</Alert>
    <Box component="form" onSubmit={async (e) => {
      e.preventDefault(); const d = new FormData(e.currentTarget)
      const response = await api.patch('/settings/ai-connection', {
        provider: 'openai', chat_model: d.get('model'), embedding_model: 'text-embedding-3-large',
        secret_reference: d.get('secret_reference'), enabled: d.get('enabled') === 'true',
      }); setResult(JSON.stringify(response.data))
    }}>
      <TextField name="model" label="Chat/Reasoning Model" placeholder="회사 승인 모델" fullWidth />
      <TextField name="secret_reference" label="Secret Reference" defaultValue="env:OPENAI_API_KEY" fullWidth sx={{ mt: 2 }} />
      <TextField name="enabled" label="외부 AI 활성화" select defaultValue="false" fullWidth sx={{ mt: 2 }}><MenuItem value="false">비활성</MenuItem><MenuItem value="true">활성</MenuItem></TextField>
      <Button type="submit" variant="contained" sx={{ mt: 2 }}>연결 설정 저장</Button>
    </Box>
    {result && <Alert severity="success" sx={{ mt: 2 }}>Secret 참조가 저장되었습니다.</Alert>}
  </CardContent></Card>
}

function KnowledgeSettings({ company }: { company?: Company }) {
  const [saved, setSaved] = useState(false)
  const [scan, setScan] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [rootDirectory, setRootDirectory] = useState('')
  const runtime = useQuery({
    queryKey: ['runtime-settings'],
    queryFn: async () => (await api.get('/settings/runtime')).data,
  })
  useEffect(() => {
    const source = runtime.data?.knowledgeSources?.find((item: { company_id?: string }) => item.company_id === company?.id)
    if (source?.root_directory) {
      setRootDirectory(source.root_directory)
       setSaved(true)
    }
  }, [runtime.data, company?.id])
  if (!company) return <Alert severity="info">회사를 먼저 등록해 주세요.</Alert>
  return <Card><CardContent>
    {rootDirectory && <Alert severity="info" sx={{ mb: 2 }}>저장된 기준서 경로: {rootDirectory}</Alert>}
    <Typography variant="body2" color="text.secondary">Docker 환경에서는 기준서 파일을 직접 업로드하세요.</Typography>
    <input type="file" multiple accept=".pdf,.hwp,.hwpx,.docx,.txt,.md,.html" onChange={async (e) => {
      const selected = e.target.files
      if (!selected?.length) return
      const form = new FormData(); Array.from(selected).forEach((file) => form.append('files', file))
      const response = await api.post('/settings/knowledge-sources/local-standards/upload', form, { params: { company_id: company.id } })
      setScan(`${response.data.uploaded}개 기준서가 PENDING으로 등록되었습니다.`)
    }} />
    <Typography variant="h6">로컬 회계기준서 폴더</Typography>
    <Typography color="text.secondary" sx={{ my: 2 }}>한 번 저장한 경로는 이후 스캔 작업에서 재사용합니다.</Typography>
    <Box component="form" onSubmit={async (e) => {
      e.preventDefault(); const d = new FormData(e.currentTarget)
      await api.patch('/settings/knowledge-sources/local-standards', { company_id: company.id, root_directory: d.get('root_directory') })
      setRootDirectory(String(d.get('root_directory') ?? ''))
      setSaved(true)
    }}>
      <TextField name="root_directory" label="기준서 루트 폴더" fullWidth required />
      <Button type="submit" variant="contained" sx={{ mt: 2 }}>경로 저장</Button>
      <Button
        type="button"
        variant="outlined"
        sx={{ mt: 2, ml: 1 }}
        disabled={!saved}
        onClick={async () => {
          const response = await api.post('/settings/knowledge-sources/local-standards/scan', null, { params: { company_id: company.id } })
          setScan(`${response.data.scanned}개 후보가 PENDING으로 등록되었습니다.`)
        }}
      >
        스캔 실행
      </Button>
    </Box>
    {saved && <Alert severity="success" sx={{ mt: 2 }}>경로가 저장되었습니다. 문서는 승인 전까지 RAG에서 제외됩니다.</Alert>}
    {scan && <Alert severity="info" sx={{ mt: 2 }}>{scan}</Alert>}
  </CardContent></Card>
}

/** Docker-compatible knowledge source screen. Kept separate while the legacy
 * folder scanner remains available for container-mounted folders. */
function KnowledgeSettingsV2({ company }: { company?: Company }) {
  const [rootDirectory, setRootDirectory] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)
  const runtime = useQuery({
    queryKey: ['runtime-settings-v2'],
    queryFn: async () => (await api.get('/settings/runtime')).data,
  })

  useEffect(() => {
    const source = runtime.data?.knowledgeSources?.find(
      (item: { company_id?: string }) => item.company_id === company?.id,
    )
    if (source?.root_directory) setRootDirectory(String(source.root_directory))
  }, [runtime.data, company?.id])

  if (!company) {
    return <Alert severity="info">먼저 회사·회계연도 탭에서 회사를 등록하세요.</Alert>
  }

  const savePath = async () => {
    setError(''); setMessage('')
    try {
      const response = await api.patch('/settings/knowledge-sources/local-standards', {
        company_id: company.id,
        root_directory: rootDirectory,
      })
      setRootDirectory(response.data.root_directory)
      setMessage('경로가 저장되었습니다.')
      await runtime.refetch()
    } catch {
      setError('경로 저장에 실패했습니다. 백엔드 연결 및 권한을 확인하세요.')
    }
  }

  const uploadFiles = async () => {
    if (!selectedFiles?.length) return
    setError(''); setMessage('')
    try {
      const form = new FormData()
      Array.from(selectedFiles).forEach((file) => form.append('files', file))
      const response = await api.post('/settings/knowledge-sources/local-standards/upload', form, {
        params: { company_id: company.id },
      })
      setMessage(`${response.data.uploaded}개 파일을 업로드하고 승인 대기(PENDING)로 등록했습니다.`)
    } catch {
      setError('파일 업로드에 실패했습니다. 백엔드 로그를 확인하세요.')
    }
  }

  const scanFolder = async () => {
    setError(''); setMessage('')
    try {
      const response = await api.post('/settings/knowledge-sources/local-standards/scan', null, {
        params: { company_id: company.id },
      })
      setMessage(`${response.data.scanned}개 파일을 승인 대기(PENDING)로 등록했습니다.`)
    } catch {
      setError('폴더 스캔에 실패했습니다. Windows 경로는 Docker에서 직접 스캔할 수 없습니다. 파일 업로드를 사용하세요.')
    }
  }

  return <Card><CardContent>
    <Typography variant="h6">회계기준서 및 지식자료</Typography>
    <Typography color="text.secondary" sx={{ my: 1 }}>
      권장 방식은 파일 업로드입니다. Windows 로컬 폴더 경로는 Docker 컨테이너에서 직접 읽을 수 없습니다.
    </Typography>
    <Box sx={{ mt: 2 }}>
      <input
        type="file"
        multiple
        accept=".pdf,.hwp,.hwpx,.docx,.txt,.md,.html"
        onChange={(event) => setSelectedFiles(event.target.files)}
      />
      <Button variant="contained" sx={{ ml: 1 }} disabled={!selectedFiles?.length} onClick={uploadFiles}>
        기준서 파일 업로드
      </Button>
    </Box>
    <TextField
      label="컨테이너 내부 기준서 폴더(선택)"
      value={rootDirectory}
      onChange={(event) => setRootDirectory(event.target.value)}
      fullWidth
      sx={{ mt: 3 }}
      helperText="예: /app/data/standards. Windows C:\\ 경로는 업로드 방식을 사용하세요."
    />
    <Box sx={{ mt: 1 }}>
      <Button variant="outlined" disabled={!rootDirectory.trim()} onClick={savePath}>경로 저장</Button>
      <Button variant="outlined" sx={{ ml: 1 }} disabled={!rootDirectory.trim()} onClick={scanFolder}>폴더 스캔 실행</Button>
    </Box>
    {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
  </CardContent></Card>
}
