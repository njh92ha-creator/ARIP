import { Box, Button, Card, CardContent, TextField, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { PMonogram } from '../components/PMonogram'

export function LoginPage() {
  const navigate = useNavigate()
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr' }}>
      <Box
        sx={{
          bgcolor: '#0E2A56',
          color: 'white',
          p: 10,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ filter: 'brightness(0) invert(1)', mb: 5 }}>
          <PMonogram />
        </Box>
        <Typography variant="h2" sx={{ fontWeight: 700, maxWidth: 620 }}>
          감사인이 질문하기 전에 먼저 준비합니다.
        </Typography>
        <Typography sx={{ mt: 3, opacity: 0.78, maxWidth: 600, fontSize: 18 }}>
          회계사건, 근거, 증빙과 대응 이력을 하나의 Risk Package로 관리합니다.
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', placeItems: 'center', p: 5 }}>
        <Card sx={{ width: '100%', maxWidth: 440 }}>
          <CardContent sx={{ p: 5 }}>
            <Typography variant="h5">ARIP 로그인</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>
              MVP 데모 세션 — 운영에서는 사내 SSO를 연결합니다.
            </Typography>
            <TextField label="사용자 ID" fullWidth defaultValue="accountant" sx={{ mb: 2 }} />
            <TextField label="비밀번호" type="password" fullWidth defaultValue="demo" />
            <Button fullWidth variant="contained" size="large" sx={{ mt: 3 }} onClick={() => navigate('/')}>
              로그인
            </Button>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}

