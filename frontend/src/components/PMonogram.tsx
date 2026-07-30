import { Box, Typography } from '@mui/material'

export function PMonogram({ compact = false }: { compact?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
      <Box
        aria-label="ARIP P monogram"
        sx={{
          width: compact ? 34 : 42,
          height: compact ? 34 : 42,
          borderRadius: 2,
          bgcolor: 'primary.main',
          color: 'white',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 800,
          fontSize: compact ? 19 : 23,
        }}
      >
        P
      </Box>
      {!compact && (
        <Box>
          <Typography sx={{ color: '#0E2A56', fontWeight: 800, letterSpacing: 0.5 }}>
            ARIP
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Audit Risk Intelligence
          </Typography>
        </Box>
      )}
    </Box>
  )
}

