import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: { main: '#1F6FD5', dark: '#124F9E', light: '#EFF6FF' },
    error: { main: '#E53935' },
    warning: { main: '#F59E0B' },
    success: { main: '#16A34A' },
    background: { default: '#F8FAFC', paper: '#FFFFFF' },
    text: { primary: '#101828', secondary: '#667085' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Noto Sans KR", Pretendard, "Apple SD Gothic Neo", sans-serif',
    h4: { fontWeight: 700, fontSize: 28 },
    h5: { fontWeight: 700, fontSize: 22 },
    h6: { fontWeight: 600, fontSize: 18 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { border: '1px solid #E5E7EB', boxShadow: 'none', borderRadius: 12 },
      },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTableCell: { styleOverrides: { head: { background: '#F8FAFC', color: '#667085', fontSize: 12, fontWeight: 700 }, root: { borderColor: '#E5E7EB', paddingTop: 12, paddingBottom: 12 } } },
    MuiOutlinedInput: { styleOverrides: { root: { background: '#FFFFFF', '&.Mui-focused': { boxShadow: '0 0 0 3px #EFF6FF' } } } },
  },
})

