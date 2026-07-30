import { Chip } from '@mui/material'

const colors: Record<string, 'error' | 'warning' | 'primary' | 'success' | 'default'> = {
  CRITICAL: 'error',
  HIGH: 'error',
  MEDIUM: 'warning',
  LOW: 'primary',
  ACCEPTED: 'success',
  DORMANT: 'default',
}

export function StatusBadge({ value }: { value: string }) {
  return (
    <Chip
      size="small"
      label={value}
      color={colors[value] ?? 'default'}
      variant={value === 'HIGH' || value === 'CRITICAL' ? 'filled' : 'outlined'}
    />
  )
}

