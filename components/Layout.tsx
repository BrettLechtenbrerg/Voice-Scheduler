import React from 'react';
import { Box, Container, AppBar, Toolbar, Typography, Button, Avatar, Menu, MenuItem } from '@mui/material';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/router';
import MicIcon from '@mui/icons-material/Mic';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LogoutIcon from '@mui/icons-material/Logout';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = () => {
    handleClose();
    signOut();
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <AppBar 
        position="static" 
        elevation={0}
        sx={{ 
          backgroundColor: 'white',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <MicIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                fontWeight: 700,
                color: 'primary.main',
                cursor: 'pointer'
              }}
              onClick={() => router.push('/')}
            >
              Voice Scheduler
            </Typography>
          </Box>

          {/* Navigation */}
          {session?.user && (
            <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
              <Button
                startIcon={<MicIcon />}
                onClick={() => router.push('/')}
                variant={router.pathname === '/' ? 'contained' : 'text'}
                size="small"
              >
                Record
              </Button>
              <Button
                startIcon={<DashboardIcon />}
                onClick={() => router.push('/dashboard')}
                variant={router.pathname === '/dashboard' ? 'contained' : 'text'}
                size="small"
              >
                Dashboard
              </Button>
            </Box>
          )}
          
          {session?.user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Welcome, {session.user.name}
              </Typography>
              <Avatar
                src={session.user.image || undefined}
                sx={{ 
                  width: 40, 
                  height: 40, 
                  cursor: 'pointer',
                  bgcolor: 'primary.main'
                }}
                onClick={handleMenu}
              >
                {session.user.name?.[0]}
              </Avatar>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <MenuItem onClick={handleSignOut}>
                  <LogoutIcon sx={{ mr: 1, fontSize: 20 }} />
                  Sign Out
                </MenuItem>
              </Menu>
            </Box>
          )}
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="md" sx={{ py: 4 }}>
        {children}
      </Container>
    </Box>
  );
}