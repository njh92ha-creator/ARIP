import { useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Grid, Stack, TextField, Typography } from '@mui/material'
import { CheckCircleOutline, CloudUploadOutlined, DescriptionOutlined, InsertDriveFileOutlined, PlayArrowOutlined, TuneOutlined } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { api, ClosingAnalysisSet, Company } from '../api'

type SourceType = 'GENERAL_LEDGER' | 'SETTLEMENT_SCHEDULE'
type Proposal = { sheet_name: string; header_row: number; mapping: Record<string, string>; missing_required: string[]; signature: string }
type SourceState = { file?: File; proposal?: Proposal; mapping: string; profileId?: string; attached: boolean }

const emptySource = (): SourceState => ({ mapping: '', attached: false })
const sourceLabel = (type: SourceType) => type === 'GENERAL_LEDGER' ? '총계정원장' : '결산 명세서'
const sourceDescription = (type: SourceType) => type === 'GENERAL_LEDGER'
  ? '거래, 계정과목, 적요 정보를 바탕으로 회계 사건과 감사 리스크를 분석합니다.'
  : '기말 잔액과 증감 신호를 바탕으로 원장 데이터와 교차 분석합니다.'

export function UploadPage() {
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<Company[]>('/companies')).data })
  const company = companies?.[0]
  const [year, setYear] = useState(new Date().getFullYear())
  const [period, setPeriod] = useState(new Date().getMonth() + 1)
  const [closingSet, setClosingSet] = useState<ClosingAnalysisSet>()
  const [ledger, setLedger] = useState<SourceState>(emptySource())
  const [settlement, setSettlement] = useState<SourceState>(emptySource())
  const [result, setResult] = useState<unknown>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!company) return <Alert severity="info">분석을 시작하기 전에 설정에서 회사를 등록해주세요.</Alert>
  const activeCompany = company
  const getSource = (type: SourceType) => type === 'GENERAL_LEDGER' ? ledger : settlement
  const setSource = (type: SourceType, value: SourceState) => type === 'GENERAL_LEDGER' ? setLedger(value) : setSettlement(value)
  const resetScope = () => { setClosingSet(undefined); setLedger(emptySource()); setSettlement(emptySource()); setResult(undefined) }

  async function ensureSet(): Promise<ClosingAnalysisSet> {
    if (closingSet && closingSet.fiscal_year === year && closingSet.fiscal_period === period) return closingSet
    const form = new FormData()
    form.append('company_id', activeCompany.id)
    form.append('fiscal_year', String(year))
    form.append('fiscal_period', String(period))
    const response = await api.post<ClosingAnalysisSet>('/closing-analysis-sets', form)
    setClosingSet(response.data)
    return response.data
  }

  async function propose(type: SourceType) {
    const source = getSource(type)
    if (!source.file) return
    setBusy(true); setError('')
    try {
      const form = new FormData()
      form.append('company_id', activeCompany.id)
      form.append('source_type', type)
      form.append('file', source.file)
      const response = await api.post<Proposal>('/mapping/propose', form)
      setSource(type, { ...source, proposal: response.data, mapping: JSON.stringify(response.data.mapping, null, 2) })
    } catch (cause: any) {
      setError(cause?.response?.data?.detail ?? `${sourceLabel(type)}의 매핑 제안 생성에 실패했습니다.`)
    } finally { setBusy(false) }
  }

  async function approveAndAttach(type: SourceType) {
    const source = getSource(type)
    if (!source.file || !source.proposal) return
    setBusy(true); setError('')
    try {
      const profile = await api.post('/mapping/approve', {
        company_id: activeCompany.id, source_type: type, sheet_name: source.proposal.sheet_name,
        header_row: source.proposal.header_row, source_signature: source.proposal.signature,
        mapping: JSON.parse(source.mapping),
      })
      const activeSet = await ensureSet()
      const form = new FormData()
      form.append('mapping_profile_id', profile.data.id)
      form.append('file', source.file)
      const endpoint = type === 'GENERAL_LEDGER'
        ? `/closing-analysis-sets/${activeSet.id}/general-ledger`
        : `/closing-analysis-sets/${activeSet.id}/settlement-schedule`
      const response = await api.post(endpoint, form)
      setClosingSet(response.data.closingAnalysisSet)
      setSource(type, { ...source, profileId: profile.data.id, attached: true })
      setResult(response.data)
    } catch (cause: any) {
      setError(cause?.response?.data?.detail ?? `${sourceLabel(type)}을(를) 결산 분석 세트에 연결하지 못했습니다.`)
    } finally { setBusy(false) }
  }

  async function analyze() {
    if (!closingSet || !ledger.attached || !settlement.attached) return
    setBusy(true); setError('')
    try {
      const response = await api.post(`/closing-analysis-sets/${closingSet.id}/analyze`)
      setResult(response.data)
      const refreshed = await api.get(`/closing-analysis-sets/${closingSet.id}`)
      setClosingSet(refreshed.data.closingAnalysisSet)
    } catch (cause: any) {
      setError(cause?.response?.data?.detail ?? '결산 분석에 실패했습니다.')
    } finally { setBusy(false) }
  }

  function sourceCard(type: SourceType) {
    const source = getSource(type)
    const missing = source.proposal?.missing_required ?? []
    return <Card variant="outlined" sx={{ height: '100%' }}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="center"><Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: '#EFF6FF', color: '#1F6FD5' }}><DescriptionOutlined /></Box><Box><Typography variant="h6">{sourceLabel(type)}</Typography><Typography variant="caption" color="text.secondary">필수 분석 자료</Typography></Box></Stack>
        {source.attached && <Chip icon={<CheckCircleOutline />} label="연결 완료" size="small" color="success" variant="outlined" />}
      </Stack>
      <Typography color="text.secondary" variant="body2" sx={{ mt: 2, minHeight: 40 }}>{sourceDescription(type)}</Typography>
      <Box sx={{ mt: 2.5, p: 2, border: '1px dashed #C2C6D5', borderRadius: 2, bgcolor: '#F8FAFC' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
          <Button component="label" variant="outlined" startIcon={<CloudUploadOutlined />} disabled={busy}>파일 선택<input hidden type="file" accept=".xlsx,.xls" onChange={(event) => setSource(type, { ...emptySource(), file: event.target.files?.[0] })} /></Button>
          {source.file ? <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}><InsertDriveFileOutlined fontSize="small" color="action" /><Typography variant="body2" noWrap title={source.file.name}>{source.file.name}</Typography></Stack> : <Typography variant="caption" color="text.secondary">.xlsx 또는 .xls 파일을 선택하세요.</Typography>}
        </Stack>
      </Box>
      <Button fullWidth variant="contained" disabled={!source.file || busy} onClick={() => propose(type)} startIcon={<TuneOutlined />} sx={{ mt: 1.5 }}>매핑 제안 생성</Button>
      {source.proposal && <Box sx={{ mt: 2 }}>
        <Alert severity={missing.length ? 'warning' : 'success'} sx={{ '& .MuiAlert-message': { minWidth: 0 } }}><Typography variant="body2" sx={{ fontWeight: 600 }}>시트: {source.proposal.sheet_name} · 헤더 행: {source.proposal.header_row}</Typography><Typography variant="caption">누락 필수 항목: {missing.join(', ') || '없음'}</Typography></Alert>
        <TextField label="매핑 JSON" multiline minRows={7} fullWidth sx={{ mt: 2 }} value={source.mapping} onChange={(event) => setSource(type, { ...source, mapping: event.target.value })} />
        <Button fullWidth variant="contained" sx={{ mt: 1.5 }} disabled={missing.length > 0 || busy} onClick={() => approveAndAttach(type)}>매핑 승인 및 자료 연결</Button>
      </Box>}
    </CardContent></Card>
  }

  const ready = Boolean(closingSet && ledger.attached && settlement.attached)
  return <Box sx={{ pb: 3 }}>
    <Box sx={{ mb: 3 }}><Typography variant="h4">결산 자료 업로드</Typography><Typography color="text.secondary" sx={{ mt: 0.75 }}>동일한 회사와 결산 기간의 총계정원장 및 결산 명세서를 연결해 통합 분석을 준비합니다.</Typography></Box>
    <Card sx={{ mb: 2.5 }}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} alignItems={{ md: 'center' }} justifyContent="space-between"><Box><Typography variant="h6">분석 범위</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{company.company_name} · 결산 기준 기간을 선택하세요.</Typography></Box><Stack direction="row" spacing={1.5}><TextField label="회계연도" type="number" value={year} onChange={(event) => { setYear(Number(event.target.value)); resetScope() }} /><TextField label="결산월" type="number" inputProps={{ min: 1, max: 12 }} value={period} onChange={(event) => { setPeriod(Number(event.target.value)); resetScope() }} /></Stack></Stack>
      {closingSet && <Alert sx={{ mt: 2.5 }} severity={closingSet.status === 'COMPLETED' ? 'success' : 'info'}>분석 세트 {closingSet.fiscal_year}-{String(closingSet.fiscal_period).padStart(2, '0')} · {closingSet.status} · 대사 상태: {closingSet.reconciliation_status}</Alert>}
    </CardContent></Card>
    <Typography variant="h6" sx={{ mb: 1.5 }}>분석 자료 연결</Typography>
    <Grid container spacing={2.5}><Grid size={{ xs: 12, lg: 6 }}>{sourceCard('GENERAL_LEDGER')}</Grid><Grid size={{ xs: 12, lg: 6 }}>{sourceCard('SETTLEMENT_SCHEDULE')}</Grid></Grid>
    <Divider sx={{ my: 3 }} />
    <Card sx={{ borderColor: ready ? 'rgba(31, 111, 213, 0.3)' : '#E5E7EB', bgcolor: ready ? 'rgba(31, 111, 213, 0.035)' : '#FFFFFF' }}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}><Box><Typography variant="h6">통합 결산 분석</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{ready ? '두 자료가 연결되었습니다. 통합 분석을 실행할 수 있습니다.' : '두 자료의 매핑을 승인하고 결산 분석 세트에 연결하면 실행할 수 있습니다.'}</Typography></Box><Button size="large" variant="contained" disabled={!ready || busy} onClick={analyze} startIcon={<PlayArrowOutlined />} sx={{ minWidth: 178 }}>결산 분석 실행</Button></Stack>
    </CardContent></Card>
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    {Boolean(result) && <Card sx={{ mt: 2.5 }}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}><Typography variant="h6">처리 결과</Typography><Box component="pre" sx={{ m: 0, mt: 1.5, p: 2, overflow: 'auto', borderRadius: 2, bgcolor: '#F8FAFC', border: '1px solid #E5E7EB', fontFamily: 'monospace', fontSize: 12 }}>{JSON.stringify(result, null, 2)}</Box></CardContent></Card>}
  </Box>
}
