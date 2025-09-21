import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Text, Card, Button, Avatar, Divider } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Loan {
  id: string | number;
  user_id: string;
  amount: number;
  interest_rate: number;
  term_months: number;
  monthly_payment: number;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed';
  application_date: string;
  approval_date?: string;
  disbursement_date?: string;
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
  const [loanFilter, setLoanFilter] = useState<'all' | 'pending' | 'approved' | 'active' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [loanDetailsVisible, setLoanDetailsVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDetailsVisible, setUserDetailsVisible] = useState(false);
  const [userLoans, setUserLoans] = useState<Loan[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
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

      if (error) {
        console.error('Error checking admin access:', error);
        // If profile doesn't exist, create it and set as admin
        if (error.code === 'PGRST116') {
          await createAdminProfile();
          return;
        }
        Alert.alert('Error', 'Failed to verify admin access.');
        return;
      }

      if (!data?.is_admin) {
        Alert.alert(
          'Access Denied', 
          'You do not have admin privileges. Please contact the system administrator.',
          [
            { text: 'OK', onPress: () => {
              // Optionally redirect to regular account view
            }}
          ]
        );
        return;
      }
    } catch (error) {
      console.error('Error checking admin access:', error);
      Alert.alert('Error', 'Failed to verify admin access.');
    }
  };

  const createAdminProfile = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata?.full_name || '',
          is_admin: true,
        });

      if (error) {
        console.error('Error creating admin profile:', error);
        Alert.alert('Error', 'Failed to create admin profile.');
      } else {
        Alert.alert(
          'Admin Profile Created',
          'Your admin profile has been created successfully!',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error creating admin profile:', error);
      Alert.alert('Error', 'Failed to create admin profile.');
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
      // First check if we have admin access
      const { data: adminCheck, error: adminError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

      if (adminError || !adminCheck?.is_admin) {
        console.log('User does not have admin access or profile not found');
        setUsers([]);
        return;
      }

      // Load all users (admin should be able to see all)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50); // Increased limit for admin view

      if (error) {
        console.error('Error loading users:', error);
        // If RLS is blocking, show helpful message
        if (error.message.includes('policy') || error.message.includes('permission')) {
          Alert.alert(
            'Permission Error',
            'Admin RLS policies may not be properly configured. Please check the database setup.',
            [{ text: 'OK' }]
          );
        }
        setUsers([]);
        return;
      }
      
      setUsers(data || []);
      console.log(`Loaded ${data?.length || 0} users for admin dashboard`);
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    }
  };

  const handleLoanAction = async (loanId: string | number, action: 'approve' | 'reject' | 'disburse' | 'complete') => {
    try {
      let updateData: any = {
        approval_date: new Date().toISOString(),
      };

      switch (action) {
        case 'approve':
          updateData.status = 'approved';
          break;
        case 'reject':
          updateData.status = 'rejected';
          break;
        case 'disburse':
          updateData.status = 'active';
          updateData.disbursement_date = new Date().toISOString();
          break;
        case 'complete':
          updateData.status = 'completed';
          break;
      }

      const { error } = await supabase
        .from('loans')
        .update(updateData)
        .eq('id', loanId);

      if (error) throw error;

      // Log activity
      const loan = loans.find(l => l.id === loanId);
      if (loan) {
        await supabase
          .from('activity_log')
          .insert({
            user_id: loan.user_id,
            activity_type: `loan_${action}`,
            description: `Loan ${action}d by admin`,
            amount: loan.amount,
          });
      }

      Alert.alert(
        'Success',
        `Loan ${action}d successfully!`
      );

      // Refresh data
      await loadLoans();
      await loadStats();
    } catch (error) {
      console.error(`Error ${action}ing loan:`, error);
      Alert.alert('Error', `Failed to ${action} loan.`);
    }
  };

  const showLoanDetails = (loan: Loan) => {
    setSelectedLoan(loan);
    setLoanDetailsVisible(true);
  };

  const closeLoanDetails = () => {
    setSelectedLoan(null);
    setLoanDetailsVisible(false);
  };

  const getFilteredLoans = () => {
    if (loanFilter === 'all') return loans;
    return loans.filter(loan => loan.status === loanFilter);
  };

  const getFilteredUsers = () => {
    if (!userSearchQuery) return users;
    return users.filter(user => 
      user.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
    );
  };

  const showUserDetails = async (user: User) => {
    setSelectedUser(user);
    setUserDetailsVisible(true);
    
    // Load user's loans
    try {
      const { data, error } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', user.id)
        .order('application_date', { ascending: false });

      if (!error) {
        setUserLoans(data || []);
      }
    } catch (error) {
      console.error('Error loading user loans:', error);
      setUserLoans([]);
    }
  };

  const closeUserDetails = () => {
    setSelectedUser(null);
    setUserDetailsVisible(false);
    setUserLoans([]);
  };

  const updateUserCreditScore = async (userId: string, newScore: number) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ credit_score: newScore })
        .eq('id', userId);

      if (error) throw error;

      Alert.alert('Success', 'Credit score updated successfully!');
      
      // Refresh user data
      await loadUsers();
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, credit_score: newScore });
      }
    } catch (error) {
      console.error('Error updating credit score:', error);
      Alert.alert('Error', 'Failed to update credit score.');
    }
  };

  const updateUserLoanLimit = async (userId: string, newLimit: number) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ loan_limit: newLimit })
        .eq('id', userId);

      if (error) throw error;

      Alert.alert('Success', 'Loan limit updated successfully!');
      
      // Refresh user data
      await loadUsers();
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, loan_limit: newLimit });
      }
    } catch (error) {
      console.error('Error updating loan limit:', error);
      Alert.alert('Error', 'Failed to update loan limit.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear any stored session data
              await AsyncStorage.removeItem('supabase.auth.token');
              
              // Sign out from Supabase
              await supabase.auth.signOut();
              
              // The App.tsx will automatically redirect to Auth component
              // when session becomes null
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
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

  const getCreditScoreColor = (score: number) => {
    if (score >= 750) return '#4CAF50'; // Green
    if (score >= 650) return '#FF9800'; // Orange
    return '#F44336'; // Red
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
      {/* Loan Filter Buttons */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { key: 'all', label: 'All', count: loans.length },
            { key: 'pending', label: 'Pending', count: loans.filter(l => l.status === 'pending').length },
            { key: 'approved', label: 'Approved', count: loans.filter(l => l.status === 'approved').length },
            { key: 'active', label: 'Active', count: loans.filter(l => l.status === 'active').length },
            { key: 'completed', label: 'Completed', count: loans.filter(l => l.status === 'completed').length },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterButton,
                loanFilter === filter.key && styles.activeFilterButton
              ]}
              onPress={() => setLoanFilter(filter.key as any)}
            >
              <Text style={[
                styles.filterButtonText,
                loanFilter === filter.key && styles.activeFilterButtonText
              ]}>
                {filter.label} ({filter.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Loans List */}
      {getFilteredLoans().map((loan) => (
        <TouchableOpacity 
          key={loan.id} 
          onPress={() => showLoanDetails(loan)}
          style={styles.loanCardTouchable}
        >
          <Card containerStyle={styles.loanCard}>
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
              <View style={styles.loanRightSection}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(loan.status) }]}>
                  <Text style={styles.statusText}>{loan.status.toUpperCase()}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6c757d" />
              </View>
            </View>
            
            <Text style={styles.loanDate}>
              Applied: {formatDate(loan.application_date)}
            </Text>

            {/* Quick Actions */}
            {loan.status === 'pending' && (
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={[styles.quickActionButton, { backgroundColor: '#28a745' }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleLoanAction(loan.id, 'approve');
                  }}
                >
                  <Ionicons name="checkmark" size={16} color="white" />
                  <Text style={styles.quickActionText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickActionButton, { backgroundColor: '#dc3545' }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleLoanAction(loan.id, 'reject');
                  }}
                >
                  <Ionicons name="close" size={16} color="white" />
                  <Text style={styles.quickActionText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}

            {loan.status === 'approved' && (
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={[styles.quickActionButton, { backgroundColor: '#007bff' }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleLoanAction(loan.id, 'disburse');
                  }}
                >
                  <Ionicons name="cash" size={16} color="white" />
                  <Text style={styles.quickActionText}>Disburse</Text>
                </TouchableOpacity>
              </View>
            )}

            {loan.status === 'active' && (
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={[styles.quickActionButton, { backgroundColor: '#6c757d' }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleLoanAction(loan.id, 'complete');
                  }}
                >
                  <Ionicons name="checkmark-circle" size={16} color="white" />
                  <Text style={styles.quickActionText}>Complete</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderUsers = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* User Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#6c757d" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users by name or email..."
            value={userSearchQuery}
            onChangeText={setUserSearchQuery}
            placeholderTextColor="#6c757d"
          />
          {userSearchQuery ? (
            <TouchableOpacity onPress={() => setUserSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#6c757d" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Users List */}
      {getFilteredUsers().map((user) => (
        <TouchableOpacity 
          key={user.id} 
          onPress={() => showUserDetails(user)}
          style={styles.userCardTouchable}
        >
          <Card containerStyle={styles.userCard}>
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
              <View style={styles.userRightSection}>
                <View style={styles.userStats}>
                  <View style={styles.statBadge}>
                    <Text style={styles.statBadgeText}>
                      Score: {user.credit_score || 0}
                    </Text>
                  </View>
                  <Text style={styles.loanLimit}>
                    Limit: {formatCurrency(user.loan_limit || 0)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6c757d" />
              </View>
            </View>
          </Card>
        </TouchableOpacity>
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

      {/* Loan Details Modal */}
      {selectedLoan && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Loan Details</Text>
              <TouchableOpacity onPress={closeLoanDetails}>
                <Ionicons name="close" size={24} color="#6c757d" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Loan Information */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Loan Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Applicant:</Text>
                  <Text style={styles.detailValue}>
                    {selectedLoan.user_name || selectedLoan.user_email}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount:</Text>
                  <Text style={[styles.detailValue, { color: '#007bff', fontWeight: '700' }]}>
                    {formatCurrency(selectedLoan.amount)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Term:</Text>
                  <Text style={styles.detailValue}>{selectedLoan.term_months} months</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Monthly Payment:</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(selectedLoan.monthly_payment)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Interest Rate:</Text>
                  <Text style={styles.detailValue}>{(selectedLoan.interest_rate * 100).toFixed(1)}% APR</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedLoan.status) }]}>
                    <Text style={styles.statusText}>{selectedLoan.status.toUpperCase()}</Text>
                  </View>
                </View>
              </View>

              {/* Timeline */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Timeline</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Applied:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedLoan.application_date)}</Text>
                </View>
                {selectedLoan.approval_date && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Approved:</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedLoan.approval_date)}</Text>
                  </View>
                )}
                {selectedLoan.disbursement_date && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Disbursed:</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedLoan.disbursement_date)}</Text>
                  </View>
                )}
              </View>

              {/* Actions */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Actions</Text>
                <View style={styles.modalActions}>
                  {selectedLoan.status === 'pending' && (
                    <>
                      <Button
                        title="Approve Loan"
                        buttonStyle={[styles.modalActionButton, { backgroundColor: '#28a745' }]}
                        onPress={() => {
                          handleLoanAction(selectedLoan.id, 'approve');
                          closeLoanDetails();
                        }}
                        icon={{ name: 'check', type: 'material', color: 'white' }}
                      />
                      <Button
                        title="Reject Loan"
                        buttonStyle={[styles.modalActionButton, { backgroundColor: '#dc3545' }]}
                        onPress={() => {
                          handleLoanAction(selectedLoan.id, 'reject');
                          closeLoanDetails();
                        }}
                        icon={{ name: 'close', type: 'material', color: 'white' }}
                      />
                    </>
                  )}
                  {selectedLoan.status === 'approved' && (
                    <Button
                      title="Disburse Loan"
                      buttonStyle={[styles.modalActionButton, { backgroundColor: '#007bff' }]}
                      onPress={() => {
                        handleLoanAction(selectedLoan.id, 'disburse');
                        closeLoanDetails();
                      }}
                      icon={{ name: 'cash', type: 'material', color: 'white' }}
                    />
                  )}
                  {selectedLoan.status === 'active' && (
                    <Button
                      title="Mark as Complete"
                      buttonStyle={[styles.modalActionButton, { backgroundColor: '#6c757d' }]}
                      onPress={() => {
                        handleLoanAction(selectedLoan.id, 'complete');
                        closeLoanDetails();
                      }}
                      icon={{ name: 'check-circle', type: 'material', color: 'white' }}
                    />
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>User Profile</Text>
              <TouchableOpacity onPress={closeUserDetails}>
                <Ionicons name="close" size={24} color="#6c757d" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* User Information */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>User Information</Text>
                <View style={styles.userProfileHeader}>
                  <Avatar
                    size={80}
                    rounded
                    source={{ uri: selectedUser.avatar_url }}
                    icon={{ name: 'person', type: 'material' }}
                    containerStyle={styles.modalAvatar}
                  />
                  <View style={styles.userProfileInfo}>
                    <Text style={styles.userProfileName}>
                      {selectedUser.full_name || 'No Name'}
                    </Text>
                    <Text style={styles.userProfileEmail}>{selectedUser.email}</Text>
                    <Text style={styles.userProfileDate}>
                      Joined: {formatDate(selectedUser.created_at)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Financial Information */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Financial Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Credit Score:</Text>
                  <View style={styles.editableValue}>
                    <Text style={[styles.detailValue, { color: getCreditScoreColor(selectedUser.credit_score || 0) }]}>
                      {selectedUser.credit_score || 0}
                    </Text>
                    <TouchableOpacity 
                      style={styles.editButton}
                      onPress={() => {
                        Alert.prompt(
                          'Update Credit Score',
                          'Enter new credit score (300-850):',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Update', 
                              onPress: (text: string | undefined) => {
                                const newScore = parseInt(text || '0');
                                if (newScore >= 300 && newScore <= 850) {
                                  updateUserCreditScore(selectedUser.id, newScore);
                                } else {
                                  Alert.alert('Error', 'Credit score must be between 300 and 850.');
                                }
                              }
                            }
                          ]
                        );
                      }}
                    >
                      <Ionicons name="create-outline" size={16} color="#007bff" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Loan Limit:</Text>
                  <View style={styles.editableValue}>
                    <Text style={[styles.detailValue, { color: '#28a745', fontWeight: '700' }]}>
                      {formatCurrency(selectedUser.loan_limit || 0)}
                    </Text>
                    <TouchableOpacity 
                      style={styles.editButton}
                      onPress={() => {
                        Alert.prompt(
                          'Update Loan Limit',
                          'Enter new loan limit:',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Update', 
                              onPress: (text: string | undefined) => {
                                const newLimit = parseFloat(text || '0');
                                if (newLimit >= 0) {
                                  updateUserLoanLimit(selectedUser.id, newLimit);
                                } else {
                                  Alert.alert('Error', 'Loan limit must be a positive number.');
                                }
                              }
                            }
                          ]
                        );
                      }}
                    >
                      <Ionicons name="create-outline" size={16} color="#007bff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Loan History */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>
                  Loan History ({userLoans.length})
                </Text>
                {userLoans.length > 0 ? (
                  userLoans.map((loan) => (
                    <View key={loan.id} style={styles.loanHistoryItem}>
                      <View style={styles.loanHistoryHeader}>
                        <Text style={styles.loanHistoryAmount}>
                          {formatCurrency(loan.amount)}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(loan.status) }]}>
                          <Text style={styles.statusText}>{loan.status.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={styles.loanHistoryDetails}>
                        {loan.term_months} months • {formatCurrency(loan.monthly_payment)}/month
                      </Text>
                      <Text style={styles.loanHistoryDate}>
                        Applied: {formatDate(loan.application_date)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noLoansText}>No loan applications found</Text>
                )}
              </View>

              {/* User Statistics */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Statistics</Text>
                <View style={styles.userStatsGrid}>
                  <View style={styles.userStatCard}>
                    <Text style={styles.userStatValue}>{userLoans.length}</Text>
                    <Text style={styles.userStatLabel}>Total Loans</Text>
                  </View>
                  <View style={styles.userStatCard}>
                    <Text style={styles.userStatValue}>
                      {userLoans.filter(l => l.status === 'active').length}
                    </Text>
                    <Text style={styles.userStatLabel}>Active Loans</Text>
                  </View>
                  <View style={styles.userStatCard}>
                    <Text style={styles.userStatValue}>
                      {formatCurrency(userLoans.reduce((sum, loan) => sum + loan.amount, 0))}
                    </Text>
                    <Text style={styles.userStatLabel}>Total Borrowed</Text>
                  </View>
                  <View style={styles.userStatCard}>
                    <Text style={styles.userStatValue}>
                      {userLoans.filter(l => l.status === 'completed').length}
                    </Text>
                    <Text style={styles.userStatLabel}>Completed</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      )}
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
  // Enhanced Loan Management Styles
  filterContainer: {
    marginVertical: 15,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  activeFilterButton: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: '#ffffff',
  },
  loanCardTouchable: {
    marginBottom: 15,
  },
  loanRightSection: {
    alignItems: 'flex-end',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  quickActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#212529',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },
  modalActions: {
    gap: 10,
  },
  modalActionButton: {
    borderRadius: 8,
    paddingVertical: 12,
  },
  // User Management Styles
  searchContainer: {
    marginVertical: 15,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#212529',
  },
  userCardTouchable: {
    marginBottom: 15,
  },
  userRightSection: {
    alignItems: 'flex-end',
  },
  statBadge: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  statBadgeText: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '600',
  },
  // User Details Modal Styles
  userProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalAvatar: {
    backgroundColor: '#e9ecef',
    borderWidth: 3,
    borderColor: '#007bff',
    marginRight: 15,
  },
  userProfileInfo: {
    flex: 1,
  },
  userProfileName: {
    fontSize: 20,
    color: '#212529',
    fontWeight: '600',
    marginBottom: 4,
  },
  userProfileEmail: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  userProfileDate: {
    fontSize: 12,
    color: '#6c757d',
  },
  editableValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    padding: 4,
  },
  loanHistoryItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  loanHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  loanHistoryAmount: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: '700',
  },
  loanHistoryDetails: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  loanHistoryDate: {
    fontSize: 12,
    color: '#6c757d',
  },
  noLoansText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  userStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  userStatCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  userStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 4,
  },
  userStatLabel: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
    textAlign: 'center',
  },
});
