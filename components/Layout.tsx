import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  AccountCircle,
  Dashboard,
  ExitToApp,
  Mic,
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import Link from 'next/link';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = () => {
    signOut();
    handleClose();
  };

  const isCurrentPath = (path: string) => {
    return router.pathname === path;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          {/* Logo */}
          <Link href="/" passHref>
            <Box
              component="a"
              sx={{
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
                color: 'inherit',
                mr: 'auto',
              }}
            >
              <Mic sx={{ mr: 1 }} />
              <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                Voice Scheduler
              </Typography>
            </Box>
          </Link>

          {/* Navigation */}
          {session && (
            <>
              <Button
                color="inherit"
                startIcon={<Mic />}
                component={Link}
                href="/"
                sx={{
                  mr: 2,
                  backgroundColor: isCurrentPath('/') ? 'rgba(255,255,255,0.1)' : 'transparent',
                }}
              >
                Record
              </Button>
              
              <Button
                color="inherit"
                startIcon={<Dashboard />}
                component={Link}
                href="/dashboard"
                sx={{
                  mr: 2,
                  backgroundColor: isCurrentPath('/dashboard') ? 'rgba(255,255,255,0.1)' : 'transparent',
                }}
              >
                Dashboard
              </Button>

              {/* User Menu */}
              <IconButton
                size="large"
                aria-label="account menu"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
              >
                <AccountCircle />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem disabled>
                  <Typography variant="body2" color="text.secondary">
                    {session.user?.email}
                  </Typography>
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleSignOut}>
                  <ExitToApp sx={{ mr: 1 }} fontSize="small" />
                  Sign Out
                </MenuItem>
              </Menu>
            </>
          )}
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container
        component="main"
        maxWidth="lg"
        sx={{
          flexGrow: 1,
          py: { xs: 2, sm: 4 },
          px: { xs: 1, sm: 2 },
        }}
      >
        {children}
      </Container>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 2,
          px: 2,
          mt: 'auto',
          backgroundColor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" align="center">
            © 2024 Voice Scheduler. Voice-activated contact management.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}