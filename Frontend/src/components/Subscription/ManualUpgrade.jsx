import React, { useState, useEffect, useRef } from "react";
import { UserPlus, Search, Mail, Phone, Calendar, Download, AlertCircle, CheckCircle, XCircle, Loader2, User, Filter, ChevronLeft, ChevronRight, CheckSquare, Square } from 'lucide-react';
import apiService from '../../services/api';

const ManualUpgrade = () => {
  // Mode state
  const [viewMode, setViewMode] = useState('single'); // 'single' or 'bulk'

  // Form state
  const [userMobile, setUserMobile] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [upgradeReason, setUpgradeReason] = useState('');

  // Bulk state
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [bulkUsers, setBulkUsers] = useState([]);
  const [activeBulkTab, setActiveBulkTab] = useState('all');
  const [bulkSearchQuery, setBulkSearchQuery] = useState('');
  const [debouncedBulkSearchQuery, setDebouncedBulkSearchQuery] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkPagination, setBulkPagination] = useState({ page: 1, totalPages: 1, totalUsers: 0 });

  const listRef = useRef(null);
  const isFetchingRef = useRef(false);

  // Search state (for functionality, card removed from UI)
  const [searchMobile, setSearchMobile] = useState('');
  const [searchedUser, setSearchedUser] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Autocomplete state
  const [autocompleteUsers, setAutocompleteUsers] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);

  // Data state
  const [availablePlans, setAvailablePlans] = useState([]);
  const [upgradeHistory, setUpgradeHistory] = useState([]);
  const [upgradeStats, setUpgradeStats] = useState({});

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 10;

  // Load data on component mount
  useEffect(() => {
    fetchAvailablePlans();
    fetchUpgradeHistory();
    fetchUpgradeStats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce bulk search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedBulkSearchQuery(bulkSearchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [bulkSearchQuery]);

  // Fetch bulk users when in bulk mode or tab/search query changes
  useEffect(() => {
    if (viewMode === 'bulk') {
      fetchBulkUsers();
      if (listRef.current) {
        listRef.current.scrollTop = 0;
      }
    }
  }, [viewMode, activeBulkTab, debouncedBulkSearchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch available plans
  const fetchAvailablePlans = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAvailablePlans();
      if (response.success) {
        setAvailablePlans(response.data.plans || []);
      }
    } catch (error) {
      setError('Failed to fetch available plans');
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch upgrade history
  const fetchUpgradeHistory = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: limit,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchTerm || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      };

      const response = await apiService.getManualUpgradeHistory(params);
      if (response.success) {
        setUpgradeHistory(response.data.upgrade_history || []);
        setTotalPages(response.data.pagination?.total_pages || 1);
        setTotalRecords(response.data.pagination?.total_records || 0);
      }
    } catch (error) {
      setError('Failed to fetch upgrade history');
      console.error('Error fetching upgrade history:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch upgrade statistics
  const fetchUpgradeStats = async () => {
    try {
      const response = await apiService.getManualUpgradeStats();
      if (response.success) {
        setUpgradeStats(response.data || {});
      }
    } catch (error) {
      console.error('Error fetching upgrade stats:', error);
    }
  };

  // Autocomplete search with debounce
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (userMobile && userMobile.length >= 3) {
        try {
          setAutocompleteLoading(true);
          const response = await apiService.searchUsersAutocomplete(userMobile, 5);
          if (response.success) {
            setAutocompleteUsers(response.data.users || []);
            setShowAutocomplete(true);
          }
        } catch (error) {
          console.error('Error in autocomplete:', error);
          setAutocompleteUsers([]);
        } finally {
          setAutocompleteLoading(false);
        }
      } else {
        setAutocompleteUsers([]);
        setShowAutocomplete(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(searchTimeout);
  }, [userMobile]);

  // Handle user selection from autocomplete
  const handleSelectUser = async (selectedMobile) => {
    setUserMobile(selectedMobile);
    setShowAutocomplete(false);
    setAutocompleteUsers([]);

    // Fetch full user details
    try {
      setSearching(true);
      setSearchError(null);
      const response = await apiService.searchUserByMobile(selectedMobile);
      if (response.success) {
        setSearchedUser(response.data);
        setSearchError(null);
      }
    } catch (error) {
      setSearchError(error.response?.data?.msg?.[0] || 'Failed to load user details');
      console.error('Error loading user details:', error);
    } finally {
      setSearching(false);
    }
  };

  // Handle user search by mobile (functionality kept, UI card removed)
  const handleSearchUser = async () => {
    if (!searchMobile || searchMobile.trim() === '') {
      setSearchError('Please enter a mobile number');
      return;
    }

    try {
      setSearching(true);
      setSearchError(null);
      setSearchedUser(null);

      const response = await apiService.searchUserByMobile(searchMobile.trim());

      if (response.success) {
        setSearchedUser(response.data);
        // Auto-fill mobile number in upgrade form
        setUserMobile(response.data.user.mobile);
        setSearchError(null);
      } else {
        setSearchError(response.msg?.[0] || 'User not found');
        setSearchedUser(null);
      }
    } catch (error) {
      setSearchError(error.response?.data?.msg?.[0] || error.message || 'Failed to search user');
      setSearchedUser(null);
      console.error('Error searching user:', error);
    } finally {
      setSearching(false);
    }
  };

  // Fetch bulk users with filtering
  const fetchBulkUsers = async () => {
    if (isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      setBulkLoading(true);
      const params = {
        filter_status: activeBulkTab,
        search_query: debouncedBulkSearchQuery,
        page: 1,
        limit: 50000 // Fetch all matching users at once
      };

      const response = await apiService.getAllUsersWithAccounts(params);
      if (response && response.success) {
        const fetchedUsers = response.users || [];
        setBulkUsers(fetchedUsers);
        setBulkPagination({
          page: 1,
          totalPages: 1,
          totalUsers: response.pagination?.total_users || response.total_users || fetchedUsers.length
        });
      }
    } catch (err) {
      console.error('Error fetching bulk users:', err);
    } finally {
      setBulkLoading(false);
      isFetchingRef.current = false;
    }
  };

  const selectAllFilteredUsers = async () => {
    if (isFetchingRef.current || bulkLoading) return;
    try {
      isFetchingRef.current = true;
      setBulkLoading(true);
      setError(null);
      
      const filterToUse = activeBulkTab === 'all' ? 'expired' : activeBulkTab;
      
      const params = {
        filter_status: filterToUse,
        search_query: debouncedBulkSearchQuery,
        page: 1,
        limit: 50000 // Fetch a very high limit to get all numbers matching the filter
      };

      const response = await apiService.getAllUsersWithAccounts(params);
      if (response && response.success) {
        const allMobiles = (response.users || []).map(u => u.mobile).filter(Boolean);
        setSelectedUsers(allMobiles);
        setSuccess(`Successfully selected all ${allMobiles.length} ${filterToUse} users.`);
      } else {
        setError(`Failed to select all matching ${filterToUse} users`);
      }
    } catch (err) {
      console.error('Error selecting all matching users:', err);
      setError('An error occurred while selecting all users');
    } finally {
      setBulkLoading(false);
      isFetchingRef.current = false;
    }
  };

  const handleBulkUpgrade = async () => {
    if (!selectedPlanId) {
      setError('Please select a plan / कृपया एक प्लान चुनें');
      return;
    }

    if (selectedUsers.length === 0) {
      setError('Please select at least one user / कृपया कम से कम एक उपयोगकर्ता चुनें');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const bulkUpgradeData = {
        user_mobiles: selectedUsers,
        subscription_id: selectedPlanId,
        upgrade_reason: upgradeReason || 'Bulk manual upgrade by admin'
      };

      const response = await apiService.bulkManualUpgradeUsers(bulkUpgradeData);

      if (response.success) {
        setSuccess(`Bulk upgrade request processed. Success: ${response.data.success.length}, Failed: ${response.data.failed.length}`);
        setSelectedUsers([]);
        setUpgradeReason('');
        setSelectedPlanId('');

        // Refresh data
        fetchUpgradeHistory();
        fetchUpgradeStats();
        fetchBulkUsers();
      } else {
        setError(response.msg?.[0] || 'Bulk upgrade failed');
      }
    } catch (err) {
      console.error('Bulk upgrade error:', err);
      setError(err.message || 'An error occurred during bulk upgrade');
    } finally {
      setLoading(false);
    }
  };

  // Handle manual upgrade submission
  const handleManualUpgrade = async (e) => {
    e.preventDefault();

    if (viewMode === 'bulk') {
      handleBulkUpgrade();
      return;
    }

    if (!userMobile || !selectedPlanId) {
      setError('Mobile number and plan are required / मोबाइल नंबर और प्लान आवश्यक हैं');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const upgradeData = {
        user_mobile: userMobile,
        subscription_id: parseInt(selectedPlanId),
        upgrade_reason: upgradeReason || 'Manual upgrade by admin'
      };

      const response = await apiService.manualUpgradeUser(upgradeData);

      if (response.success) {
        setSuccess('User upgraded successfully!');
        setUserMobile('');
        setSearchMobile('');
        setSearchedUser(null);
        setAutocompleteUsers([]);
        setShowAutocomplete(false);
        setSelectedPlanId(availablePlans[0]?.subscription_id || '');
        setUpgradeReason('');
        // Refresh data
        fetchUpgradeHistory();
        fetchUpgradeStats();
      } else {
        setError(response.msg?.[0] || 'Upgrade failed');
      }
    } catch (error) {
      setError(error.response?.data?.msg?.[0] || error.message || 'Failed to upgrade user');
      console.error('Error upgrading user:', error);
    } finally {
      setLoading(false);
    }
  };

  // Export history to CSV
  const exportHistory = async () => {
    try {
      const params = {
        limit: 1000, // Get all records for export
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchTerm || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      };

      const response = await apiService.getManualUpgradeHistory(params);

      if (response.success) {
        const history = response.data.upgrade_history || [];
        const csvContent = [
          ['Name', 'Email', 'Mobile', 'From Plan', 'To Plan', 'Amount', 'Status', 'Upgraded At', 'Reason'],
          ...history.map(upgrade => [
            upgrade.user?.name || '',
            upgrade.user?.email || '',
            upgrade.user?.mobile || '',
            upgrade.from_plan || '',
            upgrade.to_plan || '',
            upgrade.upgrade_amount || 0,
            upgrade.status_label || '',
            upgrade.upgraded_at || '',
            upgrade.upgrade_reason || ''
          ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `manual_upgrades_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      setError('Failed to export history');
      console.error('Error exporting history:', error);
    }
  };

  // Handle search and filters
  // const handleSearch = () => {
  //   setCurrentPage(1);
  //   fetchUpgradeHistory();
  // };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
    fetchUpgradeHistory();
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Auto-refresh data when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchUpgradeHistory();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [currentPage, statusFilter, searchTerm, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold">Manual Subscription Upgrade</h2>

        {/* View Mode Toggle */}
        <div className="flex bg-gray-100 p-1 rounded-lg border">
          <button
            onClick={() => setViewMode('single')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'single' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Single User
          </button>
          <button
            onClick={() => {
              setViewMode('bulk');
              if (bulkUsers.length === 0) fetchBulkUsers();
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'bulk' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Bulk Upgrade
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Section: User Selection */}
        <div className="xl:col-span-2 space-y-6">
          {viewMode === 'single' ? (
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold mb-4">Select User</h3>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Type mobile number (e.g., 9786784534)"
                    value={userMobile}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setUserMobile(value);
                      if (value.length === 0) {
                        setSearchedUser(null);
                        setShowAutocomplete(false);
                      } else {
                        setSearchedUser(null);
                        setShowAutocomplete(value.length >= 3);
                      }
                    }}
                    onFocus={() => {
                      if (userMobile.length >= 3 && autocompleteUsers.length > 0) {
                        setShowAutocomplete(true);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowAutocomplete(false), 200);
                    }}
                    required
                  />
                  {autocompleteLoading && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                  )}

                  {/* Autocomplete Dropdown */}
                  {showAutocomplete && autocompleteUsers.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {autocompleteUsers.map((user) => (
                        <div
                          key={user.user_id}
                          onClick={() => handleSelectUser(user.mobile)}
                          className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-gray-400" />
                                <span className="font-medium text-gray-900">
                                  {user.phone_code} {user.mobile}
                                </span>
                                {user.active_flag === 0 && (
                                  <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded">
                                    Inactive
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                                {user.name && user.name !== 'N/A' && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {user.name}
                                  </span>
                                )}
                                {user.email && user.email !== 'N/A' && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {user.email}
                                  </span>
                                )}
                              </div>
                            </div>
                            <CheckCircle className="w-4 h-4 text-blue-500" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <h3 className="text-lg font-semibold">Select Users ({selectedUsers.length} Selected)</h3>

                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={bulkSearchQuery}
                    onChange={(e) => setBulkSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Bulk Tabs */}
              <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
                {['all', 'free', 'paid', 'expired'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveBulkTab(tab);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap ${activeBulkTab === tab ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)} Users
                  </button>
                ))}
              </div>

              {/* User Selection List */}
              <div className="border rounded-lg overflow-hidden mb-4">
                {bulkLoading && bulkUsers.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : (
                  <div 
                    ref={listRef}
                    className="max-h-96 overflow-y-auto divide-y divide-gray-100"
                  >
                    {bulkUsers.length > 0 ? (
                      <>
                        {bulkUsers.map((user) => (
                          <div
                            key={user.user_id}
                            className={`px-4 py-3 flex items-center gap-3 hover:bg-blue-50 transition-colors cursor-pointer ${selectedUsers.includes(user.mobile) ? 'bg-blue-50/50' : ''
                              }`}
                            onClick={() => {
                              if (selectedUsers.includes(user.mobile)) {
                                setSelectedUsers(prev => prev.filter(m => m !== user.mobile));
                              } else {
                                setSelectedUsers(prev => [...prev, user.mobile]);
                              }
                            }}
                          >
                            <div className="flex-shrink-0">
                              {selectedUsers.includes(user.mobile) ? (
                                <CheckSquare className="w-5 h-5 text-blue-600" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-300" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900 truncate">{user.name || 'Unknown'}</p>
                                {user.subscription_status === 'PAID' && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold">PAID</span>
                                )}
                                {user.subscription_status === 'EXPIRED' && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-800 rounded-full font-bold">EXPIRED</span>
                                )}
                                {(user.subscription_status === 'FREE' || !user.subscription_status) && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full font-bold">FREE</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate">{user.mobile}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-[10px] text-gray-400">Created</p>
                              <p className="text-xs text-gray-600">{new Date(user.createtime).toLocaleDateString()}</p>
                            </div>
                          </div>
                        ))}
                        {bulkLoading && bulkUsers.length > 0 && (
                          <div className="flex items-center justify-center py-4 bg-gray-50/50 border-t">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                            <span className="ml-2 text-xs text-gray-500">Refreshing users...</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-12 text-center text-gray-500 text-sm">No users found match your criteria.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Bulk Selection Footer */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {activeBulkTab === 'all' ? (
                    <>
                      <button
                        onClick={() => setSelectedUsers(bulkUsers.map(u => u.mobile))}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        Select All Users ({bulkUsers.length})
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={selectAllFilteredUsers}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                        disabled={bulkLoading}
                      >
                        {bulkLoading && isFetchingRef.current && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Select All Expired Users
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setSelectedUsers(bulkUsers.map(u => u.mobile))}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Select All {activeBulkTab.charAt(0).toUpperCase() + activeBulkTab.slice(1)} Users ({bulkUsers.length})
                    </button>
                  )}
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => setSelectedUsers([])}
                    className="text-xs text-red-600 hover:text-red-800 font-semibold"
                  >
                    Clear All
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  Showing {bulkUsers.length} of {bulkPagination.totalUsers || 0} users
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Upgrade Settings */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">Upgrade Details</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upgrade To Plan <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  required
                >
                  <option value="">Select a plan</option>
                  {availablePlans.map(plan => (
                    <option key={plan.subscription_id} value={plan.subscription_id}>
                      {plan.plan_name} - ₹{plan.plan_price} ({plan.subscription_type_label})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upgrade Reason</label>
                <textarea
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  rows="2"
                  placeholder="Reason for upgrade..."
                  value={upgradeReason}
                  onChange={(e) => setUpgradeReason(e.target.value)}
                ></textarea>
              </div>

              <button
                onClick={handleManualUpgrade}
                disabled={loading || (viewMode === 'single' ? !userMobile : selectedUsers.length === 0) || !selectedPlanId}
                className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold hover:bg-blue-700 active:scale-[0.98] transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <UserPlus className="w-5 h-5" />
                )}
                {loading ? 'Processing...' : viewMode === 'single' ? 'Upgrade User' : `Upgrade ${selectedUsers.length} Users`}
              </button>

              {viewMode === 'bulk' && selectedUsers.length > 0 && (
                <p className="text-[11px] text-center text-gray-400 italic">
                  Note: Bulk upgrade will process users sequentially.
                </p>
              )}
            </div>
          </div>

          {/* Current Selection summary for bulk */}
          {viewMode === 'bulk' && selectedUsers.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Selected Users ({selectedUsers.length})</h4>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {selectedUsers.map(mobile => (
                  <div key={mobile} className="px-2 py-1 bg-white border border-blue-200 rounded text-[10px] text-blue-700 flex items-center gap-1">
                    {mobile}
                    <button onClick={() => setSelectedUsers(prev => prev.filter(m => m !== mobile))}>
                      <XCircle className="w-3 h-3 text-red-300 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Available Plans Previews */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          Plan Features Preview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availablePlans.map((plan) => (
            <div
              key={plan.subscription_id}
              className={`relative overflow-hidden p-6 rounded-xl border-2 transition-all cursor-pointer ${selectedPlanId == plan.subscription_id
                ? 'border-blue-500 bg-blue-50 shadow-md transform -translate-y-1'
                : 'border-gray-100 bg-gray-50/50 hover:bg-gray-50'
                }`}
              onClick={() => setSelectedPlanId(plan.subscription_id)}
            >
              {selectedPlanId == plan.subscription_id && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white p-1 rounded-bl-lg">
                  <CheckCircle className="w-4 h-4" />
                </div>
              )}
              <div className="mb-4">
                <h4 className="text-sm font-bold text-blue-600 uppercase tracking-widest">{plan.plan_name}</h4>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-gray-900">₹{plan.plan_price}</span>
                  <span className="text-xs text-gray-500">/ {plan.validity_days} Days</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{plan.subscription_type_label}</p>
              </div>

              <ul className="space-y-2.5">
                {plan.features?.slice(0, 4).map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start text-[11px] text-gray-600">
                    <CheckCircle className="w-3 h-3 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="leading-tight">{feature}</span>
                  </li>
                ))}
                {plan.features?.length > 4 && (
                  <li className="text-[10px] text-gray-400 pl-5">+{plan.features.length - 4} more features...</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade History */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Upgrade History</h3>
          <button
            onClick={exportHistory}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, email, or mobile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>

            <input
              type="date"
              placeholder="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <input
              type="date"
              placeholder="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <button
              onClick={clearFilters}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Clear Filters
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Loading upgrade history...</span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Upgraded At</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {upgradeHistory.map((upgrade) => (
                      <tr key={upgrade.upgrade_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{upgrade.user?.name || 'Unknown'}</div>
                            <div className="text-sm text-gray-500">{upgrade.user?.email || 'No email'}</div>
                            <div className="text-sm text-gray-500">{upgrade.user?.mobile || 'No mobile'}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {upgrade.from_plan || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {upgrade.to_plan || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ₹{upgrade.upgrade_amount || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(upgrade.status)}`}>
                            {upgrade.status_label || upgrade.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {upgrade.upgraded_at || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {upgrade.upgrade_reason || 'No reason provided'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {upgradeHistory.length === 0 && !loading && (
                <div className="text-center py-8">
                  <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No upgrade history found</h3>
                  <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{(currentPage - 1) * limit + 1}</span> to{' '}
                        <span className="font-medium">{Math.min(currentPage * limit, totalRecords)}</span> of{' '}
                        <span className="font-medium">{totalRecords}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const page = i + 1;
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === page
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                }`}
                            >
                              {page}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <UserPlus className="w-8 h-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Upgrades</p>
              <p className="text-2xl font-semibold text-gray-900">{upgradeStats.total_upgrades || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Successful</p>
              <p className="text-2xl font-semibold text-gray-900">{upgradeStats.successful_upgrades || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <XCircle className="w-8 h-8 text-red-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Failed</p>
              <p className="text-2xl font-semibold text-gray-900">{upgradeStats.failed_upgrades || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <Calendar className="w-8 h-8 text-purple-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">₹{upgradeStats.total_revenue || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualUpgrade;
