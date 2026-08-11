import { useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Link, useParams } from 'react-router-dom'
import { api, Company, RiskReviewAnswer, RiskReviewAttachment, RiskReviewCase } from '../api'
import { RiskReviewSnapshotEvidence } from './RiskReviewSnapshotEvidence'

const primary = '#0056B0'
const border = '#E5E7EB'
const cardSx = { borderColor: border, borderRadius: '12px', boxShadow: '0 1px 2px rgba(16,24,40,.04)' }
const labelSx = { color: '#667085', fontSize: 11, fontWeight: 700, letterSpacing: '.03em' }
const decisionLabel: Record<RiskReviewCase['review_decision'], string> = { CHECK: 'Check', PENDING: 'Pending', PASS: 'Pass' }
const severityLabel: Record<RiskReviewCase['severity'], string> = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' }

function errorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string' && detail) return detail
  }
  return fallback
}

function formatDate(value?: string) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ pb: 1.5, borderBottom: `1px solid ${border}` }}>
    <Typography sx={{ fontSize: 18, fontWeight: 700 }}>{children}</Typography>
    {action}
  </Stack>
}

function ReadOnlyList({ items, emptyText }: { items?: string[]; emptyText: string }) {
  if (!items?.length) return <Typography color="text.secondary" sx={{ py: 1 }}>{emptyText}</Typography>
  return <Stack component="ul" spacing={1} sx={{ pl: 2.5, mb: 0 }}>{items.map((item) => <Typography component="li" key={item} variant="body2" sx={{ lineHeight: 1.7 }}>{item}</Typography>)}</Stack>
}

function AnswerEditor({ reviewCaseId, cacheKey, question, savedAnswer }: { reviewCaseId: string; cacheKey: string; question: string; savedAnswer?: RiskReviewAnswer }) {
  const queryClient = useQueryClient()
  const [answer, setAnswer] = useState(savedAnswer?.answer ?? '')
  const mutation = useMutation({
    mutationFn: async (submittedAnswer: string) => (await api.put<RiskReviewAnswer>(
      `/risk-reviews/${reviewCaseId}/answers`,
      { question, answer: submittedAnswer },
    )).data,
    onSuccess: (saved) => {
      queryClient.setQueryData<RiskReviewCase>(['risk-review', cacheKey], (current) => current ? {
        ...current,
        answers: [...current.answers.filter((item) => item.question !== question), saved],
      } : current)
    },
  })

  return <Box sx={{ p: 2, border: `1px solid ${border}`, borderRadius: 2, bgcolor: '#FCFCFD' }}>
    <Typography fontWeight={700} sx={{ mb: 1.25 }}>{question}</Typography>
    <TextField
      fullWidth
      multiline
      minRows={3}
      value={answer}
      onChange={(event) => setAnswer(event.target.value)}
      placeholder="검토 답변을 입력해 주세요."
      aria-label={`${question} 답변`}
    />
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1} sx={{ mt: 1.25 }}>
      <Box>
        {mutation.isError ? <Typography color="error" variant="caption">{errorMessage(mutation.error, '답변을 저장하지 못했습니다.')}</Typography> : null}
        {mutation.isSuccess && answer === mutation.variables ? <Typography color="success.main" variant="caption">저장됨 · {formatDate(mutation.data.updated_at)}</Typography> : null}
      </Box>
      <Button variant="contained" size="small" startIcon={<SaveOutlinedIcon />} disabled={mutation.isPending} onClick={() => mutation.mutate(answer)}>
        {mutation.isPending ? '저장 중' : '답변 저장'}
      </Button>
    </Stack>
  </Box>
}

function SnapshotCard({ reviewCase }: { reviewCase: RiskReviewCase }) {
  const pkg = reviewCase.package
  return <Card sx={cardSx}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
    <SectionTitle action={<Chip icon={<LockOutlinedIcon />} label="읽기 전용" size="small" variant="outlined" />}>이관 시점 분석 스냅샷</SectionTitle>
    <Alert severity="info" icon={<LockOutlinedIcon />} sx={{ mt: 2 }}>아래 분석 내용은 이관 당시 복사된 기록이며 이 화면에서 변경할 수 없습니다.</Alert>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2, mt: 2.25 }}>
      <Box><Typography sx={labelSx}>분석 등급</Typography><Typography fontWeight={700} sx={{ mt: .5 }}>{reviewCase.level}</Typography></Box>
      <Box><Typography sx={labelSx}>분석 점수</Typography><Typography fontWeight={700} sx={{ mt: .5 }}>{reviewCase.score}</Typography></Box>
      <Box><Typography sx={labelSx}>중요성</Typography><Typography fontWeight={700} sx={{ mt: .5 }}>{reviewCase.materiality_level}</Typography></Box>
      <Box><Typography sx={labelSx}>분석 경로</Typography><Typography fontWeight={700} sx={{ mt: .5 }}>{reviewCase.route}</Typography></Box>
    </Box>
    <Divider sx={{ my: 2.5 }} />
    <Typography sx={labelSx}>리스크 진술</Typography>
    <Typography sx={{ mt: .75, lineHeight: 1.75 }}>{reviewCase.statement}</Typography>
    <Typography sx={{ ...labelSx, mt: 2.25 }}>종합 판단</Typography>
    <Typography color="text.secondary" sx={{ mt: .75, lineHeight: 1.75 }}>{pkg.summary || '-'}</Typography>
    <Typography sx={{ ...labelSx, mt: 2.25 }}>회계사건 추론</Typography>
    <Typography color="text.secondary" sx={{ mt: .75, lineHeight: 1.75 }}>{pkg.event_inference || '-'}</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' }, gap: 3, mt: 2.5 }}>
      <Box><Typography fontWeight={700}>회계감사 이슈</Typography><ReadOnlyList items={pkg.audit_issues} emptyText="식별된 이슈가 없습니다." /></Box>
      <Box><Typography fontWeight={700}>권장 증빙</Typography><ReadOnlyList items={pkg.evidence_checklist} emptyText="권장 증빙이 없습니다." /></Box>
      <Box><Typography fontWeight={700}>누락 사실</Typography><ReadOnlyList items={pkg.missing_facts} emptyText="누락 사실이 없습니다." /></Box>
    </Box>
    <RiskReviewSnapshotEvidence package={pkg} />
  </CardContent></Card>
}

function AttachmentCard({ reviewCase, cacheKey }: { reviewCase: RiskReviewCase; cacheKey: string }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const attachments = reviewCase.attachments ?? []
  const atLimit = attachments.length >= 10

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return (await api.post<RiskReviewAttachment>(
        `/risk-reviews/${reviewCase.id}/attachments`,
        form,
      )).data
    },
    onSuccess: (attachment) => {
      setMessage(null)
      queryClient.setQueryData<RiskReviewCase>(['risk-review', cacheKey], (current) => current ? { ...current, attachments: [...current.attachments, attachment] } : current)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (error) => setMessage(errorMessage(error, '첨부파일을 업로드하지 못했습니다.')),
  })
  const remove = useMutation({
    mutationFn: async (attachmentId: string) => api.delete(
      `/risk-reviews/${reviewCase.id}/attachments/${attachmentId}`,
    ),
    onSuccess: (_, attachmentId) => {
      setMessage(null)
      queryClient.setQueryData<RiskReviewCase>(['risk-review', cacheKey], (current) => current ? { ...current, attachments: current.attachments.filter((item) => item.id !== attachmentId) } : current)
    },
    onError: (error) => setMessage(errorMessage(error, '첨부파일을 삭제하지 못했습니다.')),
  })

  const download = async (attachment: RiskReviewAttachment) => {
    setMessage(null)
    setDownloadingId(attachment.id)
    try {
      const response = await api.get<Blob>(
        `/risk-reviews/${reviewCase.id}/attachments/${attachment.id}/download`,
        { responseType: 'blob' },
      )
      const href = URL.createObjectURL(response.data)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = attachment.filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(href)
    } catch (error) {
      setMessage(errorMessage(error, '첨부파일을 다운로드하지 못했습니다.'))
    } finally {
      setDownloadingId(null)
    }
  }

  return <Card sx={cardSx}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
    <SectionTitle action={<Chip label={`${attachments.length} / 10`} size="small" color={atLimit ? 'warning' : 'default'} variant="outlined" />}>첨부 증빙</SectionTitle>
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1.5} sx={{ mt: 2 }}>
      <Typography color="text.secondary" variant="body2">검토 케이스당 최대 10개 파일을 첨부할 수 있습니다.</Typography>
      <Button component="label" variant="outlined" startIcon={<AttachFileRoundedIcon />} disabled={atLimit || upload.isPending}>
        {upload.isPending ? '업로드 중' : '파일 첨부'}
        <input
          ref={fileInputRef}
          hidden
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) upload.mutate(file)
          }}
        />
      </Button>
    </Stack>
    {message ? <Alert severity="error" sx={{ mt: 1.5 }}>{message}</Alert> : null}
    {atLimit ? <Alert severity="warning" sx={{ mt: 1.5 }}>첨부 한도에 도달했습니다. 새 파일을 추가하려면 기존 파일을 삭제해 주세요.</Alert> : null}
    <Stack spacing={1} sx={{ mt: 2 }}>
      {attachments.length ? attachments.map((attachment) => <Stack key={attachment.id} direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.5, border: `1px solid ${border}`, borderRadius: 2 }}>
        <AttachFileRoundedIcon color="action" />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={700} variant="body2" noWrap title={attachment.filename}>{attachment.filename}</Typography>
          <Typography color="text.secondary" variant="caption">{formatBytes(attachment.size_bytes)} · {formatDate(attachment.created_at)}</Typography>
        </Box>
        <IconButton aria-label={`${attachment.filename} 다운로드`} disabled={downloadingId === attachment.id} onClick={() => void download(attachment)}>
          {downloadingId === attachment.id ? <CircularProgress size={20} /> : <DownloadRoundedIcon />}
        </IconButton>
        <IconButton aria-label={`${attachment.filename} 삭제`} color="error" disabled={remove.isPending && remove.variables === attachment.id} onClick={() => remove.mutate(attachment.id)}>
          <DeleteOutlineRoundedIcon />
        </IconButton>
      </Stack>) : <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>첨부된 증빙이 없습니다.</Typography>}
    </Stack>
  </CardContent></Card>
}

export function RiskReviewDetailPage() {
  const { riskCode } = useParams()
  const queryClient = useQueryClient()
  const [controlError, setControlError] = useState<string | null>(null)
  const { data: companies, isLoading: isCompanyLoading, isError: isCompanyError } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get<Company[]>('/companies')).data,
  })
  const company = companies?.[0]
  const { data: reviewCase, isError, error } = useQuery({
    queryKey: ['risk-review', riskCode],
    enabled: Boolean(riskCode && company),
    queryFn: async () => (await api.get<RiskReviewCase>(
      `/risk-reviews/${encodeURIComponent(riskCode!)}`,
    )).data,
  })
  const reviewCaseId = reviewCase?.id

  const decision = useMutation({
    mutationFn: async (value: RiskReviewCase['review_decision']) => {
      if (!reviewCaseId || !company) throw new Error('review case is not loaded')
      return (await api.post<RiskReviewCase>(
        `/risk-reviews/${reviewCaseId}/review-decision`,
        { decision: value },
      )).data
    },
    onMutate: async (value) => {
      setControlError(null)
      await queryClient.cancelQueries({ queryKey: ['risk-review', riskCode] })
      const previous = queryClient.getQueryData<RiskReviewCase>(['risk-review', riskCode])
      queryClient.setQueryData<RiskReviewCase>(['risk-review', riskCode], (current) => current ? { ...current, review_decision: value } : current)
      return { previousDecision: previous?.review_decision }
    },
    onError: (mutationError, _, context) => {
      const previousDecision = context?.previousDecision
      if (previousDecision) queryClient.setQueryData<RiskReviewCase>(['risk-review', riskCode], (current) => current ? { ...current, review_decision: previousDecision } : current)
      setControlError(errorMessage(mutationError, '검토 분류를 변경하지 못했습니다.'))
    },
    onSuccess: (updated) => queryClient.setQueryData<RiskReviewCase>(['risk-review', riskCode], (current) => current ? { ...current, review_decision: updated.review_decision } : updated),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['risk-reviews'] }),
  })
  const severity = useMutation({
    mutationFn: async (value: RiskReviewCase['severity']) => {
      if (!reviewCaseId || !company) throw new Error('review case is not loaded')
      return (await api.post<RiskReviewCase>(
        `/risk-reviews/${reviewCaseId}/severity`,
        { severity: value },
      )).data
    },
    onMutate: async (value) => {
      setControlError(null)
      await queryClient.cancelQueries({ queryKey: ['risk-review', riskCode] })
      const previous = queryClient.getQueryData<RiskReviewCase>(['risk-review', riskCode])
      queryClient.setQueryData<RiskReviewCase>(['risk-review', riskCode], (current) => current ? { ...current, severity: value } : current)
      return { previousSeverity: previous?.severity }
    },
    onError: (mutationError, _, context) => {
      const previousSeverity = context?.previousSeverity
      if (previousSeverity) queryClient.setQueryData<RiskReviewCase>(['risk-review', riskCode], (current) => current ? { ...current, severity: previousSeverity } : current)
      setControlError(errorMessage(mutationError, '심각도를 변경하지 못했습니다.'))
    },
    onSuccess: (updated) => queryClient.setQueryData<RiskReviewCase>(['risk-review', riskCode], (current) => current ? { ...current, severity: updated.severity } : updated),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['risk-reviews'] }),
  })
  const controlsPending = decision.isPending || severity.isPending

  if (!riskCode) return <Alert severity="error">검토 케이스 경로가 올바르지 않습니다.</Alert>
  if (isCompanyError || isError) return <Alert severity="error">{errorMessage(error, '검토 케이스를 불러오지 못했습니다.')}</Alert>
  if (!isCompanyLoading && !company) return <Alert severity="info">등록된 회사가 없습니다.</Alert>
  if (!reviewCase) return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress size={30} /></Box>
  if (!company) return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress size={30} /></Box>

  const questions = [...new Set([...(reviewCase.package.expected_questions ?? []), ...reviewCase.answers.map((item) => item.question)])]
  const answerByQuestion = new Map(reviewCase.answers.map((item) => [item.question, item]))

  return <Box>
    <Typography component={Link} to="/events" variant="body2" sx={{ color: primary, textDecoration: 'none', fontWeight: 700 }}>← 검토 목록</Typography>
    <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ lg: 'flex-end' }} spacing={2} sx={{ mt: 1.5, mb: 3 }}>
      <Box>
        <Typography variant="h4">{reviewCase.title}</Typography>
        <Typography color="text.secondary" sx={{ mt: .5 }}>리스크 ID · {reviewCase.risk_code || '-'}</Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}><Chip label={reviewCase.status} size="small" /><Chip label={`이관 ${formatDate(reviewCase.transferred_at)}`} size="small" variant="outlined" /></Stack>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ minWidth: { sm: 360 } }}>
        <FormControl fullWidth size="small">
          <InputLabel id="review-decision-label">검토 분류</InputLabel>
          <Select
            labelId="review-decision-label"
            label="검토 분류"
            value={reviewCase.review_decision}
            disabled={controlsPending}
            onChange={(event) => decision.mutate(event.target.value as RiskReviewCase['review_decision'])}
          >
            {Object.entries(decisionLabel).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl fullWidth size="small">
          <InputLabel id="review-severity-label">심각도</InputLabel>
          <Select
            labelId="review-severity-label"
            label="심각도"
            value={reviewCase.severity}
            disabled={controlsPending}
            onChange={(event) => severity.mutate(event.target.value as RiskReviewCase['severity'])}
          >
            {Object.entries(severityLabel).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>
    </Stack>
    {controlError ? <Alert severity="error" sx={{ mb: 2 }}>{controlError}</Alert> : null}
    {reviewCase.review_decision === 'PASS' ? <Alert severity="success" sx={{ mb: 2 }}>Pass로 분류되어 검토 목록에서는 숨겨집니다. 이 상세 경로는 계속 사용할 수 있습니다.</Alert> : null}
    <Stack spacing={3}>
      <SnapshotCard reviewCase={reviewCase} />
      <Card sx={cardSx}><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <SectionTitle action={<Chip label={`${reviewCase.answers.filter((item) => item.answer.trim()).length} / ${questions.length}`} size="small" variant="outlined" />}>검토 질문 및 답변</SectionTitle>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 1.5 }}>각 질문의 답변은 개별적으로 저장됩니다.</Typography>
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {questions.length ? questions.map((question) => <AnswerEditor key={question} reviewCaseId={reviewCase.id} cacheKey={riskCode} question={question} savedAnswer={answerByQuestion.get(question)} />) : <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>이관된 검토 질문이 없습니다.</Typography>}
        </Stack>
      </CardContent></Card>
      <AttachmentCard reviewCase={reviewCase} cacheKey={riskCode} />
    </Stack>
  </Box>
}
