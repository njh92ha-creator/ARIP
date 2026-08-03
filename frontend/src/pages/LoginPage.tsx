import { Box, Button, Card, Checkbox, Divider, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { BarChartOutlined, LoginOutlined, LockOutlined, ShieldOutlined, TipsAndUpdatesOutlined, VisibilityOutlined } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'

const brandFeatures = [
  { label: 'AI 기반 분석', icon: <TipsAndUpdatesOutlined fontSize="small" /> },
  { label: '컴플라이언스', icon: <ShieldOutlined fontSize="small" /> },
  { label: '실시간 모니터링', icon: <BarChartOutlined fontSize="small" /> },
]

export function LoginPage() {
  const navigate = useNavigate()

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '52% 48%' }, bgcolor: '#F8FAFC' }}>
      <Box
        component="section"
        sx={{
          display: { xs: 'none', lg: 'flex' }, position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
          p: 6, textAlign: 'center', background: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)',
          '&::before': { content: '""', position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(#1F6FD5 0.6px, transparent 0.6px)', backgroundSize: '24px 24px' },
        }}
      >
        <Stack alignItems="center" spacing={0} sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 520 }}>
          <Box sx={{ width: 112, height: 112, mb: 3.5, borderRadius: 3, bgcolor: 'rgba(31, 111, 213, 0.12)', display: 'grid', placeItems: 'center', transform: 'rotate(45deg)' }}>
            <Box sx={{ color: '#1F6FD5', transform: 'rotate(-45deg)', display: 'grid', placeItems: 'center' }}><BarChartOutlined sx={{ fontSize: 56 }} /></Box>
          </Box>
          <Typography sx={{ fontSize: 52, lineHeight: 1, fontWeight: 800, letterSpacing: '-0.04em', color: '#0E2A56' }}>ARIP</Typography>
          <Typography sx={{ mt: 1.25, color: '#1F6FD5', fontSize: 16, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Audit Risk Intelligence Platform
          </Typography>
          <Typography sx={{ mt: 4.5, color: '#0E2A56', fontSize: 28, lineHeight: 1.65, fontWeight: 700 }}>
            AI 기반 상시결산<br />감사 리스크 관리 플랫폼
          </Typography>
          <Stack direction="row" spacing={5} justifyContent="center" sx={{ width: '100%', mt: 11, pt: 6, borderTop: '1px solid rgba(31, 111, 213, 0.18)' }}>
            {brandFeatures.map(({ label, icon }) => <Stack key={label} alignItems="center" spacing={1.25} sx={{ minWidth: 92 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#FFFFFF', display: 'grid', placeItems: 'center', color: '#1F6FD5', boxShadow: '0 1px 2px rgba(14, 42, 86, 0.08)' }}>{icon}</Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#0E2A56', whiteSpace: 'nowrap' }}>{label}</Typography>
            </Stack>)}
          </Stack>
        </Stack>
        <Typography variant="caption" sx={{ position: 'absolute', bottom: 28, color: 'rgba(14, 42, 86, 0.55)' }}>© 2023 ARIP. All Rights Reserved.</Typography>
      </Box>

      <Box component="section" sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 3, sm: 6 }, bgcolor: '#F8FAFC' }}>
        <TextField select size="small" defaultValue="ko" sx={{ position: 'absolute', top: { xs: 20, sm: 40 }, right: { xs: 20, sm: 40 }, width: 130, '& .MuiOutlinedInput-root': { bgcolor: '#FFFFFF' } }}>
          <MenuItem value="ko">한국어</MenuItem>
          <MenuItem value="en">English</MenuItem>
        </TextField>
        <Card sx={{ width: '100%', maxWidth: 440, mt: { xs: 7, sm: 0 }, bgcolor: '#FFFFFF', boxShadow: '0 1px 3px rgba(14, 42, 86, 0.08)' }}>
          <Box sx={{ p: { xs: 3, sm: 5 } }}>
            <Stack alignItems="center" sx={{ mb: 4.5 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#F1F5F9', display: 'grid', placeItems: 'center', color: '#667085', mb: 2 }}><LockOutlined /></Box>
              <Typography variant="h5" sx={{ color: '#101828' }}>로그인</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 1.25, textAlign: 'center' }}>서비스 이용을 위해 아이디와 비밀번호를 입력해주세요.</Typography>
            </Stack>
            <Stack spacing={2.25}>
              <TextField label="아이디" fullWidth defaultValue="accountant" placeholder="아이디를 입력하세요" />
              <TextField label="비밀번호" type="password" fullWidth defaultValue="demo" placeholder="비밀번호를 입력하세요" slotProps={{ input: { endAdornment: <VisibilityOutlined fontSize="small" sx={{ color: '#667085' }} /> } }} />
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <FormControlLabel sx={{ ml: -1 }} control={<Checkbox size="small" />} label={<Typography variant="body2">아이디 저장</Typography>} />
                <Button variant="text" size="small" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>아이디/비밀번호 찾기</Button>
              </Stack>
              <Button fullWidth variant="contained" size="large" sx={{ py: 1.45, fontWeight: 700 }} onClick={() => navigate('/')}>로그인</Button>
              <Divider><Typography variant="body2" color="text.secondary">또는</Typography></Divider>
              <Button fullWidth variant="outlined" size="large" startIcon={<LoginOutlined />} sx={{ py: 1.35, color: '#101828', borderColor: '#D0D5DD', fontWeight: 700 }}>SSO로 로그인</Button>
            </Stack>
            <Stack direction="row" justifyContent="center" spacing={2.5} sx={{ mt: 4.5 }} divider={<Typography color="#D0D5DD">|</Typography>}>
              <Button variant="text" size="small" color="inherit" sx={{ color: 'text.secondary', minWidth: 0 }}>고객 지원</Button>
              <Button variant="text" size="small" color="inherit" sx={{ color: 'text.secondary', minWidth: 0 }}>이용 약관</Button>
            </Stack>
          </Box>
        </Card>
        <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', bottom: 24, display: { lg: 'none' } }}>© 2023 ARIP. All Rights Reserved.</Typography>
      </Box>
    </Box>
  )
}
