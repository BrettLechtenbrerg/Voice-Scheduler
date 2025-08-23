import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Pagination,
  Stack,
  Alert,
} from '@mui/material';
import {
  Search,
  Delete,
  Refresh,
  Analytics,
  People,
  Phone,
  Email,
  Business,
} from '@mui/icons-material';
import Layout from '../components/Layout';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  createdAt: string;
}

interface ContactsResponse {
  contacts: Contact[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if not authenticated
  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (status === 'unauthenticated') {
    return <div>Access denied</div>;
  }

  const fetchContacts = async (page = 1, searchTerm = search) => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        search: searchTerm,
      });

      const response = await fetch(`/api/contacts?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }

      const data: ContactsResponse = await response.json();
      setContacts(data.contacts);
      setPagination(data.pagination);
    } catch (err) {
      setError('Failed to load contacts');
      console.error('Fetch contacts error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) {
      return;
    }

    try {
      const response = await fetch(`/api/contacts?id=${contactId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete contact');
      }

      // Refresh contacts list
      fetchContacts(pagination.page);
    } catch (err) {
      setError('Failed to delete contact');
      console.error('Delete contact error:', err);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchContacts(1, search);
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    fetchContacts(page);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PROCESSED': return 'success';
      case 'PENDING': return 'warning';
      case 'FAILED': return 'error';
      default: return 'default';
    }
  };

  // Load contacts on mount
  useEffect(() => {
    fetchContacts();
  }, []);

  return (
    <>
      <Head>
        <title>Dashboard - Voice Scheduler</title>
        <meta name="description" content="Voice Scheduler contact management dashboard" />
      </Head>

      <Layout>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your voice-captured contacts and analytics
          </Typography>
        </Box>

        {/* Stats Cards */}
        <Box 
          sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
            gap: 3,
            mb: 4 
          }}
        >
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <People sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Contacts
                  </Typography>
                  <Typography variant="h4">
                    {pagination.total}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Analytics sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    This Month
                  </Typography>
                  <Typography variant="h4">
                    {contacts.filter(c => 
                      new Date(c.createdAt).getMonth() === new Date().getMonth()
                    ).length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Phone sx={{ fontSize: 40, color: 'info.main', mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Success Rate
                  </Typography>
                  <Typography variant="h4">
                    {contacts.length > 0 
                      ? Math.round((contacts.filter(c => c.status === 'PROCESSED').length / contacts.length) * 100)
                      : 0}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Email sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    With Email
                  </Typography>
                  <Typography variant="h4">
                    {contacts.filter(c => c.email).length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Search and Actions */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                sx={{ flexGrow: 1, minWidth: 300 }}
              />
              <Button 
                variant="contained" 
                startIcon={<Search />}
                onClick={handleSearch}
                disabled={loading}
              >
                Search
              </Button>
              <Button 
                variant="outlined" 
                startIcon={<Refresh />}
                onClick={() => fetchContacts(pagination.page)}
                disabled={loading}
              >
                Refresh
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Contacts Table */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Contacts ({pagination.total})
            </Typography>
            
            <TableContainer component={Paper} elevation={0}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        Loading contacts...
                      </TableCell>
                    </TableRow>
                  ) : contacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        No contacts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {contact.name}
                          </Typography>
                        </TableCell>
                        <TableCell>{contact.phone}</TableCell>
                        <TableCell>{contact.email || '-'}</TableCell>
                        <TableCell>
                          {contact.company ? (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Business sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                              {contact.company}
                            </Box>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={contact.status}
                            color={getStatusColor(contact.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(contact.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteContact(contact.id)}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Stack spacing={2}>
                  <Pagination
                    count={pagination.totalPages}
                    page={pagination.page}
                    onChange={handlePageChange}
                    color="primary"
                    showFirstButton
                    showLastButton
                  />
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      </Layout>
    </>
  );
}