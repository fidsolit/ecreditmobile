import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Text, Card, Button, Avatar, Divider } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

interface Loan {
  id: string;
  user_id: string;
  amount: number;
  interest_rate: number;
  term_months: number;
  monthly_payment: number;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed';
  application_date: string;
  approval_date?: string;
  user_email?: string;
  user_name?: string;
}

interface User {
  id: string;
  email: string;
  full_name?: string;
  created_at: string;
  credit_score?: number;
  loan_limit?: number;
  avatar_url?: string;
}

interface DashboardStats {
  totalUsers: number;
  totalLoans: number;
  pendingLoans: number;
  approvedLoans: number;
  totalLoanAmount: number;
  totalRevenue: number;
}

export default function AdminDashboard({ session }: { session: any }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'loans' | 'users'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalLoans: 0,
    pendingLoans: 0,
    approvedLoans: 0,
    totalLoanAmount: 0,
    totalRevenue: 0,
  });
  const [loans, setLoans] = useState<Loan[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (session?.user) {
      checkAdminAccess();
      loadDashboardData();
    }
  }, [session]);

  const checkAdminAccess = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

      if (error || !data?.is_admin) {
        Alert.alert('Access Denied', 'You do not have admin privileges.');
        return;
      }
    } catch (error) {
      console.error('Error checking admin access:', error);
      Alert.alert('Error', 'Failed to verify admin access.');
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadStats(),
        loadLoans(),
        loadUsers(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // Load user count
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Load loan statistics
      const { data: loanData, error: loanError } = await supabase
        .from('loans')
        .select('amount, status, monthly_payment, term_months');

      if (loanError) throw loanError;

      const totalLoans = loanData?.length || 0;
      const pendingLoans = loanData?.filter(loan => loan.status === 'pending').length || 0;
      const approvedLoans = loanData?.filter(loan => loan.status === 'approved').length || 0;
      const totalLoanAmount = loanData?.reduce((sum, loan) => sum + loan.amount, 0) || 0;
      const totalRevenue = loanData?.reduce((sum, loan) => {
        if (loan.status === 'active' || loan.status === 'completed') {
          return sum + (loan.monthly_payment * loan.term_months - loan.amount);
        }
        return sum;
      }, 0) || 0;

      setStats({
        totalUsers: userCount || 0,
        totalLoans,
        pendingLoans,
        approvedLoans,
        totalLoanAmount,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadLoans = async () => {
    try {
      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          profiles!inner(email, full_name)
        `)
        .order('application_date', { ascending: false })
        .limit(20);

      if (error) throw error;

      const formattedLoans = data?.map(loan => ({
        ...loan,
        user_email: loan.profiles?.email,
        user_name: loan.profiles?.full_name,
      })) || [];

      setLoans(formattedLoans);
    } catch (error) {
      console.error('Error loading loans:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleLoanAction = async (loanId: string, action: 'approve' | 'reject') => {
    try {
      const { error } = await supabase
        .from('loans')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          approval_date: new Date().toISOString(),
        })
        .eq('id', loanId);

      if (error) throw error;

      Alert.alert(
        'Success',
        `Loan ${action === 'approve' ? 'approved' : 'rejected'} successfully!`
      );

      // Refresh data
      await loadLoans();
      await loadStats();
    } catch (error) {
      console.error(`Error ${action}ing loan:`, error);
      Alert.alert('Error', `Failed to ${action} loan.`);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#ff9800';
      case 'approved': return '#28a745';
      case 'rejected': return '#dc3545';
      case 'active': return '#007bff';
      case 'completed': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const renderOverview = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <Card containerStyle={styles.statCard}>
          <View style={styles.statItem}>
            <Ionicons name="people" size={24} color="#007bff" />
            <Text style={styles.statLabel}>Total Users</Text>
            <Text style={styles.statValue}>{stats.totalUsers}</Text>
          </View>
        </Card>

        <Card containerStyle={styles.statCard}>
          <View style={styles.statItem}>
            <Ionicons name="document-text" size={24} color="#28a745" />
            <Text style={styles.statLabel}>Total Loans</Text>
            <Text style={styles.statValue}>{stats.totalLoans}</Text>
          </View>
        </Card>

        <Card containerStyle={styles.statCard}>
          <View style={styles.statItem}>
            <Ionicons name="time" size={24} color="#ff9800" />
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={styles.statValue}>{stats.pendingLoans}</Text>
          </View>
        </Card>

        <Card containerStyle={styles.statCard}>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={24} color="#28a745" />
            <Text style={styles.statLabel}>Approved</Text>
            <Text style={styles.statValue}>{stats.approvedLoans}</Text>
          </View>
        </Card>

        <Card containerStyle={styles.statCard}>
          <View style={styles.statItem}>
            <Ionicons name="cash" size={24} color="#007bff" />
            <Text style={styles.statLabel}>Total Amount</Text>
            <Text style={styles.statValue}>{formatCurrency(stats.totalLoanAmount)}</Text>
          </View>
        </Card>

        <Card containerStyle={styles.statCard}>
          <View style={styles.statItem}>
            <Ionicons name="trending-up" size={24} color="#28a745" />
            <Text style={styles.statLabel}>Revenue</Text>
            <Text style={styles.statValue}>{formatCurrency(stats.totalRevenue)}</Text>
          </View>
        </Card>
      </View>

      {/* Recent Activity */}
      <View style={styles.recentActivityContainer}>
        <Text h4 style={styles.sectionTitle}>Recent Loan Applications</Text>
        {loans.slice(0, 5).map((loan) => (
          <Card key={loan.id} containerStyle={styles.activityCard}>
            <View style={styles.activityItem}>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>
                  {loan.user_name || loan.user_email}
                </Text>
                <Text style={styles.activitySubtitle}>
                  {formatCurrency(loan.amount)} • {loan.term_months} months
                </Text>
                <Text style={styles.activityDate}>
                  Applied: {formatDate(loan.application_date)}
                </Text>
              </View>
              <View style={styles.activityRight}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(loan.status) }]}>
                  <Text style={styles.statusText}>{loan.status.toUpperCase()}</Text>
                </View>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );

  const renderLoans = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      {loans.map((loan) => (
        <Card key={loan.id} containerStyle={styles.loanCard}>
          <View style={styles.loanHeader}>
            <View style={styles.loanInfo}>
              <Text style={styles.loanTitle}>
                {loan.user_name || loan.user_email}
              </Text>
              <Text style={styles.loanAmount}>{formatCurrency(loan.amount)}</Text>
              <Text style={styles.loanDetails}>
                {loan.term_months} months • {formatCurrency(loan.monthly_payment)}/month
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(loan.status) }]}>
              <Text style={styles.statusText}>{loan.status.toUpperCase()}</Text>
            </View>
          </View>
          
          <Text style={styles.loanDate}>
            Applied: {formatDate(loan.application_date)}
          </Text>

          {loan.status === 'pending' && (
            <View style={styles.actionButtons}>
              <Button
                title="Approve"
                buttonStyle={[styles.actionButton, { backgroundColor: '#28a745' }]}
                onPress={() => handleLoanAction(loan.id, 'approve')}
                icon={{ name: 'check', type: 'material', color: 'white' }}
              />
              <Button
                title="Reject"
                buttonStyle={[styles.actionButton, { backgroundColor: '#dc3545' }]}
                onPress={() => handleLoanAction(loan.id, 'reject')}
                icon={{ name: 'close', type: 'material', color: 'white' }}
              />
            </View>
          )}
        </Card>
      ))}
    </ScrollView>
  );

  const renderUsers = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      {users.map((user) => (
        <Card key={user.id} containerStyle={styles.userCard}>
          <View style={styles.userHeader}>
            <Avatar
              size={50}
              rounded
              source={{ uri: user.avatar_url }}
              icon={{ name: 'person', type: 'material' }}
              containerStyle={styles.userAvatar}
            />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {user.full_name || 'No Name'}
              </Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              <Text style={styles.userDate}>
                Joined: {formatDate(user.created_at)}
              </Text>
            </View>
            <View style={styles.userStats}>
              <Text style={styles.creditScore}>
                Score: {user.credit_score || 0}
              </Text>
              <Text style={styles.loanLimit}>
                Limit: {formatCurrency(user.loan_limit || 0)}
              </Text>
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading admin dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text h3 style={styles.headerTitle}>Admin Dashboard</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#007bff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'loans' && styles.activeTab]}
          onPress={() => setActiveTab('loans')}
        >
          <Text style={[styles.tabText, activeTab === 'loans' && styles.activeTabText]}>
            Loans
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.activeTab]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>
            Users
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'loans' && renderLoans()}
        {activeTab === 'users' && renderUsers()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    color: '#212529',
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#007bff',
  },
  tabText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  // Stats Styles
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginTop: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 0,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212529',
    textAlign: 'center',
  },
  // Section Styles
  sectionTitle: {
    color: '#212529',
    fontWeight: '600',
    marginBottom: 15,
    marginTop: 20,
  },
  recentActivityContainer: {
    marginBottom: 20,
  },
  activityCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 0,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    color: '#212529',
    fontWeight: '600',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 2,
  },
  activityDate: {
    fontSize: 12,
    color: '#6c757d',
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
  },
  // Loan Card Styles
  loanCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 0,
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  loanInfo: {
    flex: 1,
  },
  loanTitle: {
    fontSize: 16,
    color: '#212529',
    fontWeight: '600',
    marginBottom: 4,
  },
  loanAmount: {
    fontSize: 18,
    color: '#007bff',
    fontWeight: '700',
    marginBottom: 4,
  },
  loanDetails: {
    fontSize: 14,
    color: '#6c757d',
  },
  loanDate: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
  },
  // User Card Styles
  userCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 0,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    backgroundColor: '#e9ecef',
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    color: '#212529',
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 2,
  },
  userDate: {
    fontSize: 12,
    color: '#6c757d',
  },
  userStats: {
    alignItems: 'flex-end',
  },
  creditScore: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600',
    marginBottom: 2,
  },
  loanLimit: {
    fontSize: 12,
    color: '#007bff',
    fontWeight: '500',
  },
});
