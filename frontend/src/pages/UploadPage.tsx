import { useState } from 'react'
import { Alert, Box, Button, Card, CardContent, MenuItem, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { api, Company } from '../api'

type Proposal = {
  sheet_name: string
  header_row: number
  mapping: Record<string, string>
  confidence: Record<string, number>
  missing_required: string[]
  signature: string
}

export function UploadPage() {
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<Company[]>('/companies')).data })
  const company = companies?.[0]
  const [sourceType, setSourceType] = useState('GENERAL_LEDGER')
  const [file, setFile] = useState<File>()
  const [proposal, setProposal] = useState<Proposal>()
  const [mapping, setMapping] = useState('')
  const [profileId, setProfileId] = useState('')
  const [result, setResult] = useState<any>()
  const [targetPeriod, setTargetPeriod] = useState('2026-07')
  const [comparison, setComparison] = useState('MOM')
  const { data: varianceProfiles = [] } = useQuery({
    queryKey: ['variance-profiles', company?.id],
    enabled: Boolean(company),
    queryFn: async () => (await api.get('/variance-settings/profiles', { params: { company_id: company!.id } })).data,
  })
  if (!company) return <Alert severity="info">Settings에서 회사를 먼저 등록해 주세요.</Alert>
  async function propose() {
    if (!file) return
    const data = new FormData(); data.append('company_id', company!.id); data.append('source_type', sourceType); data.append('file', file)
    const response = await api.post('/mapping/propose', data)
    setProposal(response.data); setMapping(JSON.stringify(response.data.mapping, null, 2))
  }
  async function approve() {
    if (!proposal) return
    const response = await api.post('/mapping/approve', {
      company_id: company!.id, source_type: sourceType, sheet_name: proposal.sheet_name,
      header_row: proposal.header_row, source_signature: proposal.signature, mapping: JSON.parse(mapping),
    })
    setProfileId(response.data.id)
  }
  async function run() {
    if (!file || !profileId || sourceType !== 'GENERAL_LEDGER') return
    const data = new FormData(); data.append('company_id', company!.id); data.append('mapping_profile_id', profileId); data.append('file', file)
    const response = await api.post('/import-jobs/general-ledger', data)
    setResult(response.data)
  }
  async function runVariance() {
    if (!file || !profileId || !varianceProfiles[0]) return
    const data = new FormData()
    data.append('company_id', company!.id)
    data.append('mapping_profile_id', profileId)
    data.append('variance_profile_id', varianceProfiles[0].id)
    data.append('target_period', targetPeriod)
    data.append('comparison', comparison)
    data.append('file', file)
    const response = await api.post('/account-variance/jobs', data)
    setResult(response.data)
  }
  return <Box>
    <Typography variant="h4">Excel Upload & Mapping</Typography>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>자동 제안 → 사용자 확인·수정 → Profile 승인 → 정규화 순서입니다.</Typography>
    <Card><CardContent>
      <TextField select label="자료 유형" value={sourceType} onChange={(e) => setSourceType(e.target.value)} sx={{ minWidth: 260 }}>
        <MenuItem value="GENERAL_LEDGER">총계정원장 (Sheet3)</MenuItem><MenuItem value="SETTLEMENT_SCHEDULE">정산표</MenuItem>
      </TextField>
      <Button component="label" variant="outlined" sx={{ ml: 2 }}>파일 선택<input hidden type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0])} /></Button>
      <Button variant="contained" onClick={propose} disabled={!file} sx={{ ml: 1 }}>매핑 제안</Button>
      {file && <Typography variant="body2" sx={{ mt: 2 }}>{file.name}</Typography>}
      {proposal && <Box sx={{ mt: 3 }}>
        <Alert severity={proposal.missing_required.length ? 'warning' : 'success'}>Sheet: {proposal.sheet_name}, Header: {proposal.header_row}, 누락: {proposal.missing_required.join(', ') || '없음'}</Alert>
        {sourceType === 'SETTLEMENT_SCHEDULE' && proposal.mapping.period === '__UPLOAD_PERIOD__' && (
          <Alert severity="info" sx={{ mt: 1 }}>
            이 정산표에는 기간 열이 없어, AVI 분석 실행 시 입력하는 기준월을 이 파일의 기간으로 사용합니다.
          </Alert>
        )}
        <TextField label="Mapping JSON" multiline minRows={12} value={mapping} onChange={(e) => setMapping(e.target.value)} fullWidth sx={{ mt: 2 }} />
        <Button variant="contained" onClick={approve} disabled={proposal.missing_required.length > 0} sx={{ mt: 2 }}>Profile 승인</Button>
      </Box>}
      {profileId && <Alert severity="success" sx={{ mt: 2 }}>
        승인 Profile: {profileId}<br />
        {sourceType === 'GENERAL_LEDGER' ? (
          <Button onClick={run}>원장 분석 실행</Button>
        ) : (
          <Box sx={{ mt: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField size="small" label="기준월" value={targetPeriod} onChange={(e) => setTargetPeriod(e.target.value)} />
            <TextField size="small" select label="비교" value={comparison} onChange={(e) => setComparison(e.target.value)} sx={{ width: 120 }}>
              <MenuItem value="MOM">MoM</MenuItem><MenuItem value="YOY">YoY</MenuItem>
            </TextField>
            <Button onClick={runVariance} disabled={!varianceProfiles.length}>AVI 분석 실행</Button>
          </Box>
        )}
      </Alert>}
      {result && <Box sx={{ mt: 2 }}><Typography variant="h6">처리 결과</Typography><pre>{JSON.stringify(result, null, 2)}</pre></Box>}
    </CardContent></Card>
  </Box>
}
