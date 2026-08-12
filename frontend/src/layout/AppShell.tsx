import {
  AppBar,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button,
  CircularProgress,
  Toolbar,
  Typography,
} from '@mui/material'
import {
  AccountBalance,
  Dashboard,
  Description,
  EventNote,
  Gavel,
  Settings,
  UploadFile,
  Refresh,
} from '@mui/icons-material'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { PMonogram } from '../components/PMonogram'

const drawerWidth = 216
const nav = [
  ['대시보드', '/', <Dashboard />],
  ['리스크 관리', '/risks', <Gavel />],
  ['리스크 검토', '/events', <EventNote />],
  ['전표 조회', '/journals', <Description />],
  ['Excel 업로드', '/uploads', <UploadFile />],
  ['설정', '/settings', <Settings />],
] as const

export function AppShell() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const reloadDatabase = useMutation({
    mutationFn: async () => (await api.post('/runtime/reload-from-database')).data,
    onSuccess: async () => { await queryClient.invalidateQueries() },
  })
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          '& .MuiDrawer-paper': { width: drawerWidth, p: 2, borderRightColor: '#E5E7EB', background: '#FFFFFF' },
        }}
      >
        <PMonogram />
        <List sx={{ mt: 3 }}>
          {nav.map(([label, path, icon]) => (
            <ListItemButton
              key={path}
              component={NavLink}
              to={path}
              selected={location.pathname === path || (path !== '/' && location.pathname.startsWith(path))}
              sx={{ borderRadius: 2, mb: 0.5, py: 1.15, '&.Mui-selected': { bgcolor: '#EFF6FF', color: 'primary.main', '& .MuiListItemIcon-root': { color: 'primary.main' } } }}
            >
              <ListItemIcon sx={{ minWidth: 38 }}>{icon}</ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          ))}
        </List>
        <Box sx={{ mt: 'auto', pt: 2 }}>
          <Button
            fullWidth
            size="small"
            variant="outlined"
            startIcon={reloadDatabase.isPending ? <CircularProgress size={15} /> : <Refresh />}
            disabled={reloadDatabase.isPending}
            onClick={() => reloadDatabase.mutate()}
            sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
          >
            DB 최신 상태 불러오기
          </Button>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, ml: `${drawerWidth}px`, bgcolor: 'background.default' }}>
        <AppBar
          position="sticky"
          elevation={0}
          color="inherit"
          sx={{ borderBottom: '1px solid #E5E7EB' }}
        >
          <Toolbar>
            <Typography sx={{ flexGrow: 1, fontWeight: 600 }}>ARIP 업무 포털</Typography>
            <Typography variant="body2" color="text.secondary">
              Excel Only · Human-in-the-loop
            </Typography>
          </Toolbar>
        </AppBar>
        <Box sx={{ p: 3, maxWidth: 1720, mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

