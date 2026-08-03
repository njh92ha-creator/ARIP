import { Chip } from '@mui/material'

const colors: Record<string, 'error' | 'warning' | 'primary' | 'secondary' | 'success' | 'default'> = {
  CRITICAL: 'error',
  HIGH: 'error',
  MEDIUM: 'warning',
  LOW: 'primary',
  ACCEPTED: 'success',
  DORMANT: 'default',
  OPEN: 'primary', REVIEW: 'primary', IN_REVIEW: 'primary', EVIDENCE_ATTACHED: 'secondary',
  REASSESSMENT: 'warning', RESOLVED: 'success',
}

const labels: Record<string, string> = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low', CRITICAL: 'Critical', OPEN: 'Open', REVIEW: 'Review', IN_REVIEW: 'Review', EVIDENCE_ATTACHED: 'Evidence Attached', REASSESSMENT: 'Re-evaluate', RESOLVED: 'Resolved', ACCEPTED: 'Accepted', DORMANT: 'Dormant' }

export function StatusBadge({ value }: { value: string }) {
  return (
    <Chip
      size="small"
      label={labels[value] ?? value}
      color={colors[value] ?? 'default'}
      variant={value === 'HIGH' || value === 'CRITICAL' ? 'filled' : 'outlined'}
    />
  )
}

