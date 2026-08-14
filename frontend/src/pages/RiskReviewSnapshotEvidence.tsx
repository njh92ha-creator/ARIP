import {
  Box,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { Risk } from '../api'

const border = '#E5E7EB'

type SnapshotPackage = Risk['package']

export function RiskReviewSnapshotEvidence({ package: pkg }: { package: SnapshotPackage }) {
  const similarReviewCases = pkg.review_similarity_cases ?? []
  const references = pkg.standards_evidence?.length
    ? pkg.standards_evidence
    : (pkg.references ?? []).map((reference) => ({
        source: reference.source || 'Legacy',
        title: reference.title || reference.name || '기준서 참조',
        paragraph: reference.paragraph || '',
        excerpt: reference.excerpt || reference.description || '',
        url: reference.url || '',
      }))

  return <Stack spacing={2.5} sx={{ mt: 2.5 }}>
    <Box>
      <Typography fontWeight={700} sx={{ mb: 1.25 }}>원장 증빙</Typography>
      {pkg.ledger_evidence?.length ? <Box sx={{ overflowX: 'auto', border: `1px solid ${border}`, borderRadius: 2 }}>
        <Table size="small" aria-label="이관 시점 원장 증빙">
          <TableHead><TableRow>
            <TableCell>전표번호</TableCell>
            <TableCell>전기일</TableCell>
            <TableCell>계정명</TableCell>
            <TableCell>차대</TableCell>
            <TableCell align="right">금액</TableCell>
            <TableCell>적요</TableCell>
          </TableRow></TableHead>
          <TableBody>{pkg.ledger_evidence.map((row, index) => <TableRow key={`${row.documentNumber}-${row.postingDate}-${index}`}>
            <TableCell>{row.documentNumber || '-'}</TableCell>
            <TableCell>{row.postingDate || '-'}</TableCell>
            <TableCell>{row.accountName || '-'}</TableCell>
            <TableCell>{row.debitCredit || '-'}</TableCell>
            <TableCell align="right">{row.amount || '-'}</TableCell>
            <TableCell>{row.description || '-'}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </Box> : <Typography color="text.secondary">복사된 원장 증빙이 없습니다.</Typography>}
    </Box>

    <Box>
      <Typography fontWeight={700} sx={{ mb: 1.25 }}>기준서 근거</Typography>
      {references.length ? <Stack spacing={1.25}>{references.map((reference, index) => <Box key={`${reference.source}-${reference.title}-${index}`} sx={{ p: 1.5, border: `1px solid ${border}`, borderRadius: 2 }}>
        <Typography fontWeight={700} variant="body2">{reference.source} · {reference.title}{reference.paragraph ? ` · ${reference.paragraph}` : ''}</Typography>
        {reference.excerpt ? <Typography color="text.secondary" variant="body2" sx={{ mt: .75, lineHeight: 1.7 }}>{reference.excerpt}</Typography> : null}
        {reference.url ? <Link href={reference.url} target="_blank" rel="noreferrer" variant="body2" sx={{ display: 'inline-block', mt: .75 }}>원문 열기</Link> : null}
      </Box>)}</Stack> : <Typography color="text.secondary">확인 가능한 기준서 근거가 없습니다.</Typography>}
    </Box>

    {similarReviewCases.length ? <Box>
      <Typography fontWeight={700} sx={{ mb: 1.25 }}>유사사례검색</Typography>
      <Stack spacing={1.25}>{similarReviewCases.map((reviewCase) => <Box key={reviewCase.riskCode} sx={{ p: 1.5, border: `1px solid ${border}`, borderRadius: 2, bgcolor: '#EFF8FF' }}>
        <Typography fontWeight={700} variant="body2">유사 클리어 검토 사례 · {Math.round(reviewCase.similarity * 100)}%</Typography>
        <Link href={`/risk-reviews/${encodeURIComponent(reviewCase.riskCode)}`} variant="body2" sx={{ display: 'inline-block', mt: .75, fontWeight: 700 }}>{reviewCase.riskCode} · {reviewCase.title}</Link>
        <Typography color="text.secondary" variant="body2" sx={{ mt: .5 }}>검토 분류 {reviewCase.reviewDecision} · 심각도 {reviewCase.severity}</Typography>
      </Box>)}</Stack>
    </Box> : null}
  </Stack>
}
