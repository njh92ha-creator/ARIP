import {
  AppBar,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material'
import {
  AccountBalance,
  Analytics,
  Dashboard,
  Description,
  EventNote,
  Gavel,
  Settings,
  UploadFile,
} from '@mui/icons-material'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { PMonogram } from '../components/PMonogram'

const drawerWidth = 232
const nav = [
  ['Dashboard', '/', <Dashboard />],
  ['Audit Risk', '/risks', <Gavel />],
  ['Accounting Events', '/events', <EventNote />],
  ['Journal', '/journals', <Description />],
  ['Account Variance', '/account-variance', <Analytics />],
  ['Excel Upload', '/uploads', <UploadFile />],
  ['Settings', '/settings', <Settings />],
] as const

export function AppShell() {
  const location = useLocation()
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          '& .MuiDrawer-paper': { width: drawerWidth, p: 2, borderRightColor: '#E5E7EB' },
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
              sx={{ borderRadius: 2, mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 38 }}>{icon}</ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, ml: `${drawerWidth}px` }}>
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

