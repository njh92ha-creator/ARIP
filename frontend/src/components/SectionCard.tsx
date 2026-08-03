import { Card, CardContent, Stack, Typography } from '@mui/material'
import { ReactNode } from 'react'

export function SectionCard({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return <Card><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>{title && <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}><Typography variant="h6">{title}</Typography>{action}</Stack>}{children}</CardContent></Card>
}
