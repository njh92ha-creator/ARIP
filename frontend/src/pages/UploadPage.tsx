import { useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Divider, Stack, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { api, ClosingAnalysisSet, Company } from '../api'

type SourceType = 'GENERAL_LEDGER' | 'SETTLEMENT_SCHEDULE'
type Proposal = { sheet_name: string; header_row: number; mapping: Record<string, string>; missing_required: string[]; signature: string }
type SourceState = { file?: File; proposal?: Proposal; mapping: string; profileId?: string; attached: boolean }

const emptySource = (): SourceState => ({ mapping: '', attached: false })
const sourceLabel = (type: SourceType) => type === 'GENERAL_LEDGER' ? 'General Ledger' : 'Settlement Schedule'

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

  if (!company) return <Alert severity="info">Create company settings before starting an analysis.</Alert>
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
      setError(cause?.response?.data?.detail ?? `${sourceLabel(type)} mapping proposal failed.`)
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
      setError(cause?.response?.data?.detail ?? `${sourceLabel(type)} could not be attached to the closing set.`)
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
      setError(cause?.response?.data?.detail ?? 'Closing analysis failed.')
    } finally { setBusy(false) }
  }

  function sourceCard(type: SourceType) {
    const source = getSource(type)
    const missing = source.proposal?.missing_required ?? []
    return <Card variant="outlined"><CardContent>
      <Typography variant="h6">{sourceLabel(type)}</Typography>
      <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
        {type === 'GENERAL_LEDGER' ? 'Transaction, account and description evidence for Events and Audit Risk.' : 'Closing balances and variance signals for cross-analysis.'}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Button component="label" variant="outlined" disabled={busy}>Select file<input hidden type="file" accept=".xlsx,.xls" onChange={(event) => setSource(type, { ...emptySource(), file: event.target.files?.[0] })} /></Button>
        <Button variant="contained" disabled={!source.file || busy} onClick={() => propose(type)}>Propose mapping</Button>
        {source.file && <Typography variant="body2">{source.file.name}</Typography>}
      </Stack>
      {source.proposal && <Box sx={{ mt: 2 }}>
        <Alert severity={missing.length ? 'warning' : 'success'}>Sheet: {source.proposal.sheet_name}; Header: {source.proposal.header_row}; Missing: {missing.join(', ') || 'none'}</Alert>
        <TextField label="Mapping JSON" multiline minRows={7} fullWidth sx={{ mt: 2 }} value={source.mapping} onChange={(event) => setSource(type, { ...source, mapping: event.target.value })} />
        <Button variant="contained" sx={{ mt: 2 }} disabled={missing.length > 0 || busy} onClick={() => approveAndAttach(type)}>Approve mapping and attach</Button>
      </Box>}
      {source.attached && <Alert severity="success" sx={{ mt: 2 }}>Attached to this Closing Analysis Set.</Alert>}
    </CardContent></Card>
  }

  const ready = Boolean(closingSet && ledger.attached && settlement.attached)
  return <Box>
    <Typography variant="h4">Closing Analysis Set</Typography>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Analyze the General Ledger and Settlement Schedule together for the same company, fiscal year and month.</Typography>
    <Card sx={{ mb: 2 }}><CardContent>
      <Typography variant="h6" sx={{ mb: 2 }}>Scope</Typography>
      <Stack direction="row" spacing={2}>
        <TextField label="Fiscal year" type="number" value={year} onChange={(event) => { setYear(Number(event.target.value)); resetScope() }} />
        <TextField label="Fiscal month" type="number" inputProps={{ min: 1, max: 12 }} value={period} onChange={(event) => { setPeriod(Number(event.target.value)); resetScope() }} />
      </Stack>
      {closingSet && <Alert sx={{ mt: 2 }} severity={closingSet.status === 'COMPLETED' ? 'success' : 'info'}>Set {closingSet.fiscal_year}-{String(closingSet.fiscal_period).padStart(2, '0')} | {closingSet.status} | Reconciliation: {closingSet.reconciliation_status}</Alert>}
    </CardContent></Card>
    <Stack spacing={2}>{sourceCard('GENERAL_LEDGER')}{sourceCard('SETTLEMENT_SCHEDULE')}</Stack>
    <Divider sx={{ my: 3 }} />
    <Button size="large" variant="contained" disabled={!ready || busy} onClick={analyze}>Run closing analysis</Button>
    {!ready && <Typography color="text.secondary" sx={{ ml: 2, display: 'inline' }}>Attach and approve both source files to run the integrated analysis.</Typography>}
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    {Boolean(result) && <Box sx={{ mt: 3 }}><Typography variant="h6">Result</Typography><pre>{String(JSON.stringify(result, null, 2))}</pre></Box>}
  </Box>
}
