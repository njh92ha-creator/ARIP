import { useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  BarChartOutlined,
  LightbulbOutlined,
  LockOutlined,
  LoginOutlined,
  SecurityOutlined,
  VisibilityOffOutlined,
  VisibilityOutlined,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'

const brandFeatures = [
  { label: 'AI 기반 분석', icon: <LightbulbOutlined /> },
  { label: '컴플라이언스', icon: <SecurityOutlined /> },
  { label: '실시간 모니터링', icon: <BarChartOutlined /> },
]

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    height: 50,
    borderRadius: '6px',
    fontSize: 16,
    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
    '& fieldset': { borderColor: '#D0D5DD' },
    '&:hover fieldset': { borderColor: '#98A2B3' },
    '&.Mui-focused fieldset': { borderColor: '#1F6FD5' },
  },
  '& input': { px: 2, py: 1.5 },
  '& input::placeholder': { color: '#98A2B3', opacity: 1 },
}

export function LoginPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)

  return (
    <Box
      component="main"
      sx={{
        width: '100%',
        height: '100vh',
        minHeight: 720,
        display: 'flex',
        overflow: 'hidden',
        bgcolor: '#F8FAFC',
        fontFamily: '"Noto Sans KR", sans-serif',
      }}
    >
      <Box
        component="section"
        sx={{
          position: 'relative',
          width: '52%',
          flexShrink: 0,
          display: { xs: 'none', lg: 'flex' },
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          p: 6,
          background: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            opacity: 0.1,
            backgroundImage: 'radial-gradient(#1F6FD5 0.5px, transparent 0.5px)',
            backgroundSize: '24px 24px',
          },
        }}
      >
        <Stack
          alignItems="center"
          sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 512, textAlign: 'center' }}
        >
          <Box sx={{ position: 'relative', width: 96, height: 96, mb: 4 }}>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                borderRadius: '12px',
                bgcolor: '#1F6FD5',
                opacity: 0.1,
                transform: 'rotate(45deg)',
              }}
            />
            <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#1F6FD5' }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2 2 7l10 5 10-5-10-5Z" />
                <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </Box>
          </Box>

          <Box sx={{ mb: 5 }}>
            <Typography sx={{ color: '#0E2A56', fontSize: 48, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.025em', mb: 1 }}>
              ARIP
            </Typography>
            <Typography sx={{ color: '#1F6FD5', fontSize: 14, lineHeight: 1.5, fontWeight: 500, letterSpacing: '0.025em', textTransform: 'uppercase', mb: 3 }}>
              Audit Risk Intelligence Platform
            </Typography>
            <Typography sx={{ color: '#0E2A56', fontSize: 24, lineHeight: 1.65, fontWeight: 700 }}>
              AI 기반 상시결산
              <br />
              감사 리스크 관리 플랫폼
            </Typography>
          </Box>

          <Box
            sx={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              columnGap: 4,
              mt: 6,
              pt: 6,
              borderTop: '1px solid #BFDBFE',
            }}
          >
            {brandFeatures.map(({ label, icon }) => (
              <Stack key={label} alignItems="center">
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    bgcolor: '#FFFFFF',
                    color: '#1F6FD5',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: '0 1px 2px rgba(14, 42, 86, 0.08)',
                    mb: 1.5,
                    '& .MuiSvgIcon-root': { fontSize: 24 },
                  }}
                >
                  {icon}
                </Box>
                <Typography sx={{ color: '#0E2A56', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {label}
                </Typography>
              </Stack>
            ))}
          </Box>
        </Stack>

        <Typography sx={{ position: 'absolute', bottom: 32, color: 'rgba(14, 42, 86, 0.5)', fontSize: 12, fontWeight: 500 }}>
          © 2023 ARIP. All Rights Reserved.
        </Typography>
      </Box>

      <Box
        component="section"
        sx={{
          position: 'relative',
          width: { xs: '100%', lg: '48%' },
          minWidth: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflowY: 'auto',
          p: { xs: 3, sm: 6 },
          bgcolor: '#F8FAFC',
        }}
      >
        <Select
          defaultValue="ko"
          size="small"
          aria-label="언어 선택"
          sx={{
            position: 'absolute',
            top: 32,
            right: 32,
            width: 104,
            height: 35,
            bgcolor: '#FFFFFF',
            color: '#667085',
            fontSize: 14,
            borderRadius: '6px',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#D0D5DD' },
          }}
        >
          <MenuItem value="ko">한국어</MenuItem>
          <MenuItem value="en">English</MenuItem>
        </Select>

        <Box
          sx={{
            width: '100%',
            maxWidth: 440,
            mt: { xs: 7, lg: 0 },
            p: { xs: 4, sm: 5 },
            bgcolor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(16, 24, 40, 0.08)',
          }}
        >
          <Stack alignItems="center" sx={{ mb: 5 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#F1F5F9', color: '#667085', display: 'grid', placeItems: 'center', mb: 2 }}>
              <LockOutlined sx={{ fontSize: 24 }} />
            </Box>
            <Typography sx={{ color: '#101828', fontSize: 24, lineHeight: 1.4, fontWeight: 700 }}>
              로그인
            </Typography>
            <Typography sx={{ color: '#667085', mt: 1, fontSize: 14, lineHeight: 1.5, textAlign: 'center' }}>
              서비스 이용을 위해 아이디와 비밀번호를 입력해주세요.
            </Typography>
          </Stack>

          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault()
              navigate('/')
            }}
          >
            <Stack spacing={3}>
              <Box>
                <Typography component="label" htmlFor="login-id" sx={{ display: 'block', color: '#101828', fontSize: 14, fontWeight: 500, mb: 0.75 }}>
                  아이디
                </Typography>
                <TextField id="login-id" name="id" fullWidth placeholder="아이디를 입력하세요" autoComplete="username" sx={fieldSx} />
              </Box>

              <Box>
                <Typography component="label" htmlFor="login-password" sx={{ display: 'block', color: '#101828', fontSize: 14, fontWeight: 500, mb: 0.75 }}>
                  비밀번호
                </Typography>
                <TextField
                  id="login-password"
                  name="password"
                  fullWidth
                  type={showPassword ? 'text' : 'password'}
                  placeholder="비밀번호를 입력하세요"
                  autoComplete="current-password"
                  sx={fieldSx}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <IconButton
                          aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                          edge="end"
                          size="small"
                          onClick={() => setShowPassword((visible) => !visible)}
                          sx={{ color: '#667085', mr: 0.25 }}
                        >
                          {showPassword ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
                        </IconButton>
                      ),
                    },
                  }}
                />
              </Box>

              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <FormControlLabel
                  control={<Checkbox size="small" sx={{ p: 0.5, mr: 0.5 }} />}
                  label="아이디 저장"
                  sx={{ m: 0, '& .MuiFormControlLabel-label': { color: '#101828', fontSize: 14 } }}
                />
                <Button variant="text" size="small" sx={{ minWidth: 0, p: 0, color: '#1F6FD5', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>
                  아이디/비밀번호 찾기
                </Button>
              </Stack>

              <Stack spacing={2}>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{ height: 51, borderRadius: '6px', bgcolor: '#1F6FD5', fontSize: 14, fontWeight: 700, '&:hover': { bgcolor: '#1A5FBA' } }}
                >
                  로그인
                </Button>

                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Box sx={{ height: '1px', flex: 1, bgcolor: '#E5E7EB' }} />
                  <Typography sx={{ color: '#667085', fontSize: 14 }}>또는</Typography>
                  <Box sx={{ height: '1px', flex: 1, bgcolor: '#E5E7EB' }} />
                </Stack>

                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<LoginOutlined sx={{ fontSize: '16px !important' }} />}
                  sx={{ height: 51, borderRadius: '6px', borderColor: '#D0D5DD', color: '#101828', fontSize: 14, fontWeight: 600, '&:hover': { borderColor: '#D0D5DD', bgcolor: '#F8FAFC' }, '& .MuiButton-startIcon': { color: '#667085' } }}
                >
                  SSO로 로그인
                </Button>
              </Stack>
            </Stack>
          </Box>

          <Stack direction="row" alignItems="center" justifyContent="center" spacing={3} sx={{ mt: 5 }}>
            <Button variant="text" sx={{ minWidth: 0, p: 0, color: '#667085', fontSize: 14, fontWeight: 400 }}>고객 지원</Button>
            <Typography sx={{ color: '#D0D5DD', fontSize: 14 }}>|</Typography>
            <Button variant="text" sx={{ minWidth: 0, p: 0, color: '#667085', fontSize: 14, fontWeight: 400 }}>이용 약관</Button>
          </Stack>
        </Box>

        <Typography sx={{ display: { xs: 'block', lg: 'none' }, mt: 4, color: '#667085', fontSize: 12 }}>
          © 2023 ARIP. All Rights Reserved.
        </Typography>
      </Box>
    </Box>
  )
}
