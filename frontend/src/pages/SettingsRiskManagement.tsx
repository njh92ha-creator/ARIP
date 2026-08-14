import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import ShieldOutlined from '@mui/icons-material/ShieldOutlined'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { api, Company, Risk } from '../api'

const decisionLabel: Record<string, string> = { CHECK: 'Check', PENDING: 'Pending', PASS: 'Pass' }

export function SettingsRiskManagement({ company }: { company?: Company }) {
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const risks = useQuery({
    queryKey: ['risk-management', company?.id],
    enabled: Boolean(company),
    queryFn: async () => (await api.get<Risk[]>('/settings/risk-management', { params: { company_id: company!.id } })).data,
  })
  const selectedRisks = useMemo(() => (risks.data ?? []).filter((risk) => selectedIds.has(risk.id)), [risks.data, selectedIds])
  const removeSelected = useMutation({
    mutationFn: async () => Promise.all(selectedRisks.map((risk) => api.delete(`/risks/${risk.id}`, { data: { expected_version: risk.row_version } }))),
    onSuccess: async () => {
      setSelectedIds(new Set())
      setConfirmOpen(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['risk-management'] }),
        queryClient.invalidateQueries({ queryKey: ['risks'] }),
        queryClient.invalidateQueries({ queryKey: ['risk-reviews'] }),
      ])
    },
  })
  const compactSelected = useMutation({
    mutationFn: async () => {
      for (const risk of selectedRisks) {
        await api.post(`/risks/${risk.id}/compact-analysis-text`)
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['risk-management'] }),
        queryClient.invalidateQueries({ queryKey: ['risks'] }),
      ])
    },
  })
  const toggle = (id: string) => setSelectedIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleAll = () => setSelectedIds(selectedIds.size === (risks.data?.length ?? 0) ? new Set() : new Set((risks.data ?? []).map((risk) => risk.id)))

  return <>
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #E5E7EB', bgcolor: '#FAFBFC' }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Stack direction="row" spacing={1.25} alignItems="center"><ShieldOutlined color="action" /><Typography variant="h6" fontWeight={700}>리스크 분석 결과 관리</Typography></Stack><Button color="error" variant="contained" startIcon={<DeleteOutline />} disabled={selectedIds.size === 0 || removeSelected.isPending} onClick={() => setConfirmOpen(true)}>선택 항목 영구 삭제 ({selectedIds.size})</Button></Stack></Box>
      <CardContent sx={{ p: 3 }}>
        <Button variant="outlined" size="small" disabled={selectedIds.size === 0 || compactSelected.isPending || removeSelected.isPending} onClick={() => compactSelected.mutate()} sx={{ mb: 2 }}>
          기존 문구 요약 적용 ({selectedIds.size})
        </Button>
        {compactSelected.isError && <Alert severity="error" sx={{ mb: 2 }}>문구 요약 저장에 실패했습니다.</Alert>}
        <Alert severity="warning" sx={{ mb: 2.5 }}>체크한 리스크 결과와 해당 리스크의 이력·감사 로그를 DB에서 영구 삭제합니다. 원본 원장·정산표·기준서는 유지됩니다.</Alert>
        <TableContainer sx={{ border: '1px solid #E5E7EB', borderRadius: 3 }}><Table size="small"><TableHead><TableRow><TableCell padding="checkbox"><Checkbox indeterminate={selectedIds.size > 0 && selectedIds.size < (risks.data?.length ?? 0)} checked={(risks.data?.length ?? 0) > 0 && selectedIds.size === risks.data?.length} onChange={toggleAll} /></TableCell><TableCell>리스크</TableCell><TableCell>검토 분류</TableCell><TableCell>분석 일시</TableCell></TableRow></TableHead><TableBody>
          {risks.isLoading ? <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}>불러오는 중...</TableCell></TableRow> :
            !(risks.data?.length) ? <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5, color: 'text.secondary' }}>저장된 리스크 분석 결과가 없습니다.</TableCell></TableRow> :
              risks.data.map((risk) => <TableRow key={risk.id} hover selected={selectedIds.has(risk.id)} onClick={() => toggle(risk.id)} sx={{ cursor: 'pointer' }}><TableCell padding="checkbox"><Checkbox checked={selectedIds.has(risk.id)} onClick={(event) => event.stopPropagation()} /></TableCell><TableCell><Typography fontWeight={700}>{risk.title}</Typography><Typography variant="caption" color="text.secondary">{risk.id}</Typography></TableCell><TableCell><Chip size="small" label={decisionLabel[risk.review_decision ?? 'CHECK']} /></TableCell><TableCell>{risk.analyzed_at ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(risk.analyzed_at)).replace(',', '') : '-'}</TableCell></TableRow>)}
        </TableBody></Table></TableContainer>
        {removeSelected.isError && <Alert severity="error" sx={{ mt: 2 }}>일부 리스크 삭제에 실패했습니다. 목록을 새로고침하여 남은 항목을 확인해 주세요.</Alert>}
      </CardContent>
    </Card>
    <Dialog open={confirmOpen} onClose={() => !removeSelected.isPending && setConfirmOpen(false)} maxWidth="xs" fullWidth><DialogTitle>선택 리스크 영구 삭제</DialogTitle><DialogContent><Typography>{selectedRisks.length}개 리스크 분석 결과를 영구 삭제하시겠습니까?</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>이 작업은 되돌릴 수 없습니다.</Typography></DialogContent><DialogActions><Button disabled={removeSelected.isPending} onClick={() => setConfirmOpen(false)}>취소</Button><Button color="error" variant="contained" disabled={removeSelected.isPending} onClick={() => removeSelected.mutate()}>{removeSelected.isPending ? '삭제 중' : `${selectedRisks.length}개 영구 삭제`}</Button></DialogActions></Dialog>
  </>
}
