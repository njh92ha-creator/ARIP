import { Box, Card, CardContent, Typography } from '@mui/material'

export function KpiCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string
  value: string | number
  helper?: string
  tone?: 'primary' | 'error' | 'warning' | 'success'
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography color="text.secondary" variant="body2">
          {label}
        </Typography>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: `${tone ?? 'primary'}.main` }} />
        </Box>
        <Typography sx={{ fontSize: 32, fontWeight: 700, mt: 1, letterSpacing: '-0.03em' }}>{value}</Typography>
        {helper && (
          <Typography variant="caption" color="text.secondary">
            {helper}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

