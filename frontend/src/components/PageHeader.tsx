import { Box, Stack, Typography } from '@mui/material'
import { ReactNode } from 'react'

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-end' }} spacing={2} sx={{ mb: 3 }}><Box><Typography variant="h4">{title}</Typography>{description && <Typography color="text.secondary" sx={{ mt: 0.75 }}>{description}</Typography>}</Box>{actions && <Box>{actions}</Box>}</Stack>
}
