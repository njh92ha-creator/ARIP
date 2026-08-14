import { FormEvent, useState } from 'react'
import { Alert, Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material'
import { BarChartOutlined, LightbulbOutlined, LockOutlined, SecurityOutlined, VisibilityOffOutlined, VisibilityOutlined } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const brandFeatures = [
  { label: 'AI 기반 분석', icon: <LightbulbOutlined /> },
  { label: '회계 리스크 검토', icon: <SecurityOutlined /> },
  { label: '실시간 모니터링', icon: <BarChartOutlined /> },
]
const fieldSx = { '& .MuiOutlinedInput-root': { height: 50, borderRadius: '6px', fontSize: 16, boxShadow: '0 1px 2px rgba(16,24,40,.05)', '& fieldset': { borderColor: '#D0D5DD' }, '&:hover fieldset': { borderColor: '#98A2B3' }, '&.Mui-focused fieldset': { borderColor: '#1F6FD5' } } }

export function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [department, setDepartment] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailEditable, setEmailEditable] = useState(false)
  const [passwordEditable, setPasswordEditable] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (mode === 'signup' && password !== confirmPassword) { setError('비밀번호와 비밀번호 확인이 일치하지 않습니다.'); return }
    setSubmitting(true)
    try {
      if (mode === 'signup') {
        await api.post('/auth/signup', { email, password, full_name: fullName, birth_date: birthDate, department, job_title: jobTitle })
        setMode('login')
        setPassword('')
        setConfirmPassword('')
        setNotice('회원가입이 완료되었습니다. 로그인해 주세요.')
      } else {
        const response = await api.post('/auth/login', { email, password })
        sessionStorage.setItem('arip-login-email', email.trim().toLowerCase())
        sessionStorage.setItem('arip-login-name', response.data.full_name || email.trim().toLowerCase())
        navigate('/', { replace: true })
      }
    } catch (requestError: any) {
      const status = requestError.response?.status
      setError(status === 409 ? '이미 가입된 이메일입니다.' : status === 401 ? '이메일 또는 비밀번호가 올바르지 않습니다.' : '로그인 처리에 실패했습니다. 다시 시도해 주세요.')
    } finally { setSubmitting(false) }
  }
  const switchMode = () => { setMode((current) => current === 'login' ? 'signup' : 'login'); setConfirmPassword(''); setError(''); setNotice('') }

  return <Box component="main" sx={{ width: '100%', height: '100vh', minHeight: 720, display: 'flex', overflow: 'hidden', bgcolor: '#F8FAFC', fontFamily: '"Noto Sans KR", sans-serif' }}>
    <Box component="section" sx={{ position: 'relative', width: '52%', flexShrink: 0, display: { xs: 'none', lg: 'flex' }, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', p: 6, background: 'linear-gradient(135deg,#E0F2FE 0%,#BAE6FD 100%)', '@keyframes aripDotDrift': { '0%': { backgroundPosition: '0 0' }, '100%': { backgroundPosition: '24px 24px' } }, '@keyframes aripBrandFloat': { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } }, '@keyframes aripBrandPulse': { '0%': { transform: 'scale(.8)', opacity: 0 }, '35%': { opacity: .26 }, '100%': { transform: 'scale(1.55)', opacity: 0 } }, '@keyframes aripFeaturePulse': { '0%, 100%': { transform: 'translateY(0)', boxShadow: '0 1px 2px rgba(14,42,86,.08)' }, '50%': { transform: 'translateY(-4px)', boxShadow: '0 8px 18px rgba(31,111,213,.16)' } }, '&::before': { content: '""', position: 'absolute', inset: 0, opacity: .1, backgroundImage: 'radial-gradient(#1F6FD5 .5px,transparent .5px)', backgroundSize: '24px 24px', animation: 'aripDotDrift 18s linear infinite' }, '@media (prefers-reduced-motion: reduce)': { '& *, &::before': { animation: 'none !important' } } }}>
      <Stack alignItems="center" sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 512, textAlign: 'center' }}>
        <Box sx={{ position: 'relative', width: 96, height: 96, mb: 4, animation: 'aripBrandFloat 4.8s ease-in-out infinite' }}><Box sx={{ position: 'absolute', width: 120, height: 120, left: -12, top: -12, border: '1px solid rgba(31,111,213,.38)', borderRadius: '50%', animation: 'aripBrandPulse 4.8s ease-out infinite' }} /><Box sx={{ position: 'absolute', inset: 0, borderRadius: 3, bgcolor: '#1F6FD5', opacity: .1, transform: 'rotate(45deg)' }} /><Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#1F6FD5' }}><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5M2 12l10 5 10-5" /></svg></Box></Box>
        <Box sx={{ mb: 5 }}><Typography sx={{ color: '#0E2A56', fontSize: 48, lineHeight: 1, fontWeight: 700, letterSpacing: '-.025em', mb: 1 }}>ARIP</Typography><Typography sx={{ color: '#1F6FD5', fontSize: 14, fontWeight: 500, letterSpacing: '.025em', textTransform: 'uppercase', mb: 3 }}>Audit Risk Intelligence Platform</Typography><Typography sx={{ color: '#0E2A56', fontSize: 24, lineHeight: 1.65, fontWeight: 700 }}>AI 기반 결산·감사 리스크<br />관리 플랫폼</Typography></Box>
        <Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', columnGap: 4, mt: 6, pt: 6, borderTop: '1px solid #BFDBFE' }}>{brandFeatures.map(({ label, icon }, index) => <Stack key={label} alignItems="center"><Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#FFF', color: '#1F6FD5', display: 'grid', placeItems: 'center', boxShadow: '0 1px 2px rgba(14,42,86,.08)', mb: 1.5, animation: 'aripFeaturePulse 4.8s ease-in-out infinite', animationDelay: `${index * .45}s` }}>{icon}</Box><Typography sx={{ color: '#0E2A56', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</Typography></Stack>)}</Box>
      </Stack>
    </Box>
    <Box component="section" sx={{ width: { xs: '100%', lg: '48%' }, minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', p: { xs: 3, sm: 6 }, bgcolor: '#F8FAFC' }}>
      <Box sx={{ width: '100%', maxWidth: 440, p: { xs: 4, sm: 5 }, bgcolor: '#FFF', border: '1px solid #E5E7EB', borderRadius: 2, boxShadow: '0 1px 3px rgba(16,24,40,.08)' }}>
        <Stack alignItems="center" sx={{ mb: 4 }}><Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#F1F5F9', color: '#667085', display: 'grid', placeItems: 'center', mb: 2 }}><LockOutlined sx={{ fontSize: 24 }} /></Box><Typography sx={{ color: '#101828', fontSize: 24, fontWeight: 700 }}>{mode === 'login' ? '로그인' : '회원가입'}</Typography><Typography sx={{ color: '#667085', mt: 1, fontSize: 14, textAlign: 'center' }}>{mode === 'login' ? '이메일과 비밀번호를 입력해 주세요.' : '이메일 형식의 ID로 계정을 만듭니다.'}</Typography></Stack>
        <Box component="form" onSubmit={submit} autoComplete="off"><Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}{notice && <Alert severity="success">{notice}</Alert>}
          {mode === 'signup' && <Box><Typography component="label" htmlFor="signup-name" sx={{ display: 'block', fontSize: 14, fontWeight: 500, mb: .75 }}>이름</Typography><TextField id="signup-name" fullWidth required value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="off" sx={fieldSx} /></Box>}
          <Box><Typography component="label" htmlFor="login-email" sx={{ display: 'block', fontSize: 14, fontWeight: 500, mb: .75 }}>이메일</Typography><TextField id="login-email" name="arip-login-email" type="email" fullWidth required value={email} onFocus={() => setEmailEditable(true)} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="off" slotProps={{ input: { readOnly: !emailEditable } }} sx={fieldSx} /></Box>
          <Box><Typography component="label" htmlFor="login-password" sx={{ display: 'block', fontSize: 14, fontWeight: 500, mb: .75 }}>비밀번호</Typography><TextField id="login-password" name="arip-login-password" fullWidth required type={showPassword ? 'text' : 'password'} value={password} onFocus={() => setPasswordEditable(true)} onChange={(event) => setPassword(event.target.value)} autoComplete="off" slotProps={{ input: { readOnly: !passwordEditable, endAdornment: <IconButton aria-label="비밀번호 보기" edge="end" size="small" onClick={() => setShowPassword((visible) => !visible)} sx={{ color: '#667085', mr: .25 }}>{showPassword ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}</IconButton> } }} sx={fieldSx} /></Box>
          {mode === 'signup' && <><Box><Typography component="label" htmlFor="confirm-password" sx={{ display: 'block', fontSize: 14, fontWeight: 500, mb: .75 }}>비밀번호 확인</Typography><TextField id="confirm-password" name="arip-confirm-password" fullWidth required type={showPassword ? 'text' : 'password'} value={confirmPassword} onFocus={() => setPasswordEditable(true)} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="off" slotProps={{ input: { readOnly: !passwordEditable } }} sx={fieldSx} /></Box><Box><Typography component="label" htmlFor="signup-birth-date" sx={{ display: 'block', fontSize: 14, fontWeight: 500, mb: .75 }}>생년월일</Typography><TextField id="signup-birth-date" type="date" fullWidth required value={birthDate} onChange={(event) => setBirthDate(event.target.value)} sx={fieldSx} /></Box><Box><Typography component="label" htmlFor="signup-department" sx={{ display: 'block', fontSize: 14, fontWeight: 500, mb: .75 }}>부서</Typography><TextField id="signup-department" fullWidth required value={department} onChange={(event) => setDepartment(event.target.value)} autoComplete="off" sx={fieldSx} /></Box><Box><Typography component="label" htmlFor="signup-job-title" sx={{ display: 'block', fontSize: 14, fontWeight: 500, mb: .75 }}>직급</Typography><TextField id="signup-job-title" fullWidth required value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} autoComplete="off" sx={fieldSx} /></Box></>}
          <Button type="submit" fullWidth variant="contained" disabled={submitting} sx={{ height: 51, borderRadius: '6px', bgcolor: '#1F6FD5', fontSize: 14, fontWeight: 700, '&:hover': { bgcolor: '#1A5FBA' } }}>{submitting ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}</Button>
          <Button fullWidth variant="text" onClick={switchMode} sx={{ color: '#1F6FD5', fontWeight: 600 }}>{mode === 'login' ? '회원가입' : '로그인으로 돌아가기'}</Button>
        </Stack></Box>
      </Box>
    </Box>
  </Box>
}
