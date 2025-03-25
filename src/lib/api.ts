import React, { useState, useEffect } from 'react';
import { Facebook, Instagram, Bot, Save, Trash2, Book, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getSocialConnections, getTokenRefreshHistory, getWebhookConfigsByUserId } from '../lib/api';
import { checkAndRefreshTokens, getDaysUntilExpiry, manuallyRefreshToken } from '../lib/tokenRefresh';
import { loginWithFacebook, checkFacebookLoginStatus, handleFacebookStatusChange } from '../lib/facebookAuth';
import type { SocialConnection, TokenRefreshHistory, TokenRefreshResult, WebhookConfig } from '../types';
import LoadingIndicator from '../components/LoadingIndicator';
import ErrorAlert from '../components/ErrorAlert';

export default function Settings() {
  const [socialConnections, setSocialConnections] = useState<SocialConnection[]>([]);
  const [refreshHistory, setRefreshHistory] = useState<TokenRefreshHistory[]>([]);
  const [webhookConfigs, setWebhookConfigs] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('connections');
  const [refreshingTokens, setRefreshingTokens] = useState(false);
  const [refreshResults, setRefreshResults] = useState<TokenRefreshResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fbConnecting, setFbConnecting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        // Get the current user
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          throw new Error('User not authenticated');
        }
        
        // Load social connections
        try {
          const connections = await getSocialConnections();
          setSocialConnections(connections);
        } catch (connError) {
          console.error('Error loading social connections:', connError);
          // Continue loading other data
        }
        
        // Load webhook configs
        try {
          const webhooks = await getWebhookConfigsByUserId(userData.user.id);
          setWebhookConfigs(webhooks);
        } catch (webhookError) {
          console.error('Error loading webhook configs:', webhookError);
          // Continue loading other data
        }
        
        // Load token refresh history
        try {
          const history = await getTokenRefreshHistory(userData.user.id);
          setRefreshHistory(history);
        } catch (historyError) {
          console.error('Error loading token refresh history:', historyError);
          // Continue loading other data
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load settings data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const getFacebookConnection = () => {
    return socialConnections.find(conn => conn.fb_page_id);
  };
  
  const getInstagramConnection = () => {
    return socialConnections.find(conn => conn.ig_account_id);
  };

  const handleFacebookConnect = async () => {
    setFbConnecting(true);
    try {
      // First check if user is already logged in to Facebook
      if (typeof FB !== 'undefined') {
        const statusResponse = await checkFacebookLoginStatus();
        
        if (statusResponse.status === 'connected') {
          // User already logged in to Facebook
          const success = await handleFacebookStatusChange(statusResponse);
          if (success) {
            // Handle success - normally we'd continue to page selection
            // But for this demo, we'll just redirect to the callback URL
            window.location.href = `${window.location.origin}/oauth/facebook/callback?code=demo_code`;
            return;
          }
        }
        
        // If not connected or handling failed, initiate login
        const loginResponse = await loginWithFacebook();
        if (loginResponse.status === 'connected') {
          // If connected after login, redirect to callback
          window.location.href = `${window.location.origin}/oauth/facebook/callback?code=demo_code`;
          return;
        }
      }

      // Fallback to redirect flow if FB SDK isn't working correctly
      const redirectUri = `${window.location.origin}/oauth/facebook/callback`;
      window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${import.meta.env.VITE_META_APP_ID}&redirect_uri=${redirectUri}&scope=pages_show_list,pages_messaging`;
    } catch (err) {
      console.error('Error connecting to Facebook:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to Facebook');
    } finally {
      setFbConnecting(false);
    }
  };

  const handleInstagramConnect = () => {
    const redirectUri = `${window.location.origin}/oauth/instagram/callback`;
    window.location.href = `https://api.instagram.com/oauth/authorize?client_id=${import.meta.env.VITE_META_APP_ID}&redirect_uri=${redirectUri}&scope=instagram_basic,instagram_manage_messages&response_type=code`;
  };
  
  const handleDisconnectSocial = async (connectionId: string) => {
    if (!connectionId) {
      setError("No connection ID provided");
      return;
    }
    
    if (!confirm('Are you sure you want to disconnect this account?')) return;
    
    try {
      const { error } = await supabase
        .from('social_connections')
        .delete()
        .eq('id', connectionId);
        
      if (error) throw error;
      
      // Update the list by removing the deleted connection
      setSocialConnections(prevConnections => 
        prevConnections.filter(conn => conn.id !== connectionId)
      );
      
      alert('Successfully disconnected account');
    } catch (error) {
      console.error('Error disconnecting account:', error);
      setError(error instanceof Error ? error.message : 'Failed to disconnect account');
    }
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  const getExpiryStatusClass = (expiryDate: string) => {
    const daysRemaining = getDaysUntilExpiry(expiryDate);
    if (daysRemaining <= 5) return 'text-red-600';
    if (daysRemaining <= 14) return 'text-yellow-600';
    return 'text-green-600';
  };
  
  const getExpiryStatus = (expiryDate: string) => {
    const daysRemaining = getDaysUntilExpiry(expiryDate);
    if (daysRemaining <= 0) return 'Expired';
    if (daysRemaining === 1) return '1 day remaining';
    return `${daysRemaining} days remaining`;
  };
  
  const handleRefreshAllTokens = async () => {
    setRefreshingTokens(true);
    setRefreshResults([]);
    setError(null);
    
    try {
      const results = await checkAndRefreshTokens();
      if (results && results.length > 0) {
        setRefreshResults(results);
        
        // Reload connections to show updated expiry dates
        const connections = await getSocialConnections();
        setSocialConnections(connections);
        
        // Reload refresh history
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const history = await getTokenRefreshHistory(user.id);
          setRefreshHistory(history);
        }
      } else {
        // No tokens needed refreshing
        setRefreshResults([{
          id: 'none',
          platform: 'none',
          status: 'success',
          new_expiry: 'No tokens needed refreshing'
        }]);
      }
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      setError(error instanceof Error ? error.message : 'Failed to refresh tokens');
    } finally {
      setRefreshingTokens(false);
    }
  };
  
  const handleRefreshSingleToken = async (connectionId: string) => {
    if (!connectionId) {
      setError("No connection ID provided");
      return;
    }
    
    setRefreshingTokens(true);
    setRefreshResults([]);
    setError(null);
    
    try {
      const refreshedConnection = await manuallyRefreshToken(connectionId);
      
      // Create refresh result
      setRefreshResults([{
        id: connectionId,
        platform: refreshedConnection.fb_page_id ? 'facebook' : 'instagram',
        status: 'success',
        new_expiry: refreshedConnection.token_expiry
      }]);
      
      // Reload connections to show updated expiry dates
      const connections = await getSocialConnections();
      setSocialConnections(connections);
      
      // Reload refresh history
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const history = await getTokenRefreshHistory(user.id);
        setRefreshHistory(history);
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      setError(error instanceof Error ? error.message : 'Failed to refresh token');
      setRefreshResults([{
        id: connectionId,
        platform: 'unknown',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }]);
    } finally {
      setRefreshingTokens(false);
    }
  };

  const handleDataDeletion = () => {
    if (window.confirm('Are you sure you want to request deletion of all your data? This action cannot be undone.')) {
      // In a real implementation, you would call your API to initiate the data deletion process
      window.location.href = '/deletion-status?code=MANUAL' + Math.random().toString(36).substring(2, 10).toUpperCase();
    }
  };

  const getTabsForUser = () => {
    // Base tabs every user should see
    const tabs = [
      { id: 'connections', label: 'Social Connections' },
      { id: 'token-management', label: 'Token Management' },
      { id: 'privacy', label: 'Privacy & Data' }
    ];
    
    return tabs;
  };

  if (loading) {
    return <LoadingIndicator message="Loading settings..." />;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {getTabsForUser().map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <ErrorAlert 
          message="Error" 
          details={error} 
          onDismiss={() => setError(null)} 
        />
      )}
      
      {activeTab === 'connections' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Social Media Connections</h3>
            <div className="mt-5 space-y-4">
              <div className="border rounded-md overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <h4 className="text-sm font-medium text-gray-700">Facebook Pages</h4>
                </div>
                
                {getFacebookConnection() ? (
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Facebook className="h-5 w-5 text-blue-600 mr-2" />
                        <span className="text-sm text-gray-900">
                          Connected to Page ID: {getFacebookConnection()?.fb_page_id}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className={`text-xs mr-3 flex items-center ${getExpiryStatusClass(getFacebookConnection()?.token_expiry || '')}`}>
                          <Clock className="h-4 w-4 mr-1" />
                          {getExpiryStatus(getFacebookConnection()?.token_expiry || '')}
                        </span>
                        <button
                          onClick={() => handleDisconnectSocial(getFacebookConnection()?.id || '')}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    {/* Only show the direct manual button (no FB SDK button) */}
                    <button
                      onClick={handleFacebookConnect}
                      disabled={fbConnecting}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {fbConnecting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Facebook className="h-5 w-5 mr-2" />
                          Connect Facebook Page
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
              
              <div className="border rounded-md overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <h4 className="text-sm font-medium text-gray-700">Instagram Business Account</h4>
                </div>
                
                {getInstagramConnection() ? (
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Instagram className="h-5 w-5 text-pink-600 mr-2" />
                        <span className="text-sm text-gray-900">
                          Connected to Account ID: {getInstagramConnection()?.ig_account_id}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className={`text-xs mr-3 flex items-center ${getExpiryStatusClass(getInstagramConnection()?.token_expiry || '')}`}>
                          <Clock className="h-4 w-4 mr-1" />
                          {getExpiryStatus(getInstagramConnection()?.token_expiry || '')}
                        </span>
                        <button
                          onClick={() => handleDisconnectSocial(getInstagramConnection()?.id || '')}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <button
                      onClick={handleInstagramConnect}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
                    >
                      <Instagram className="h-5 w-5 mr-2" />
                      Connect Instagram Account
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'token-management' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Token Management</h3>
                <button
                  onClick={handleRefreshAllTokens}
                  disabled={refreshingTokens || socialConnections.length === 0}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {refreshingTokens ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh All Tokens
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Manage your social media access tokens. Tokens are automatically refreshed 7 days before expiry.
              </p>
              
              {refreshResults.length > 0 && (
                <div className={`mt-4 p-4 rounded-md ${
                  refreshResults.some(r => r.status === 'error') 
                    ? 'bg-red-50' 
                    : 'bg-green-50'
                }`}>
                  <h4 className="text-sm font-medium mb-2">
                    {refreshResults.some(r => r.status === 'error')
                      ? 'Token Refresh Results (with errors)'
                      : 'Token Refresh Successful'}
                  </h4>
                  <ul className="space-y-2">
                    {refreshResults.map((result, idx) => (
                      result.id !== 'none' ? (
                        <li key={idx} className="text-sm">
                          {result.status === 'success' ? (
                            <span className="text-green-700">
                              ✓ {result.platform} token refreshed. New expiry: {formatDate(result.new_expiry || '')}
                            </span>
                          ) : (
                            <span className="text-red-700">
                              ✗ Failed to refresh {result.platform} token: {result.error}
                            </span>
                          )}
                        </li>
                      ) : (
                        <li key={idx} className="text-sm text-gray-700">
                          No tokens needed refreshing at this time.
                        </li>
                      )
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="mt-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">Active Social Connections</h4>
                {socialConnections.length === 0 ? (
                  <div className="text-center p-6 bg-gray-50 rounded-md">
                    <AlertTriangle className="h-10 w-10 text-yellow-500 mx-auto mb-2" />
                    <p className="text-gray-500">No social connections found</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Connect at least one social account to manage tokens
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Platform
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ID
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Token Expiry
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Refreshed
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {socialConnections.map((connection) => (
                          <tr key={connection.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {connection.fb_page_id ? (
                                  <Facebook className="h-5 w-5 text-blue-600 mr-2" />
                                ) : (
                                  <Instagram className="h-5 w-5 text-pink-600 mr-2" />
                                )}
                                <span className="text-sm text-gray-900">
                                  {connection.fb_page_id ? 'Facebook' : 'Instagram'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {connection.fb_page_id || connection.ig_account_id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`text-sm ${getExpiryStatusClass(connection.token_expiry)}`}>
                                {formatDate(connection.token_expiry)}
                                <br />
                                <span className="text-xs">
                                  {getExpiryStatus(connection.token_expiry)}
                                </span>
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {connection.refreshed_at ? formatDate(connection.refreshed_at) : 'Never'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => handleRefreshSingleToken(connection.id)}
                                disabled={refreshingTokens}
                                className="text-indigo-600 hover:text-indigo-900 mr-4 inline-flex items-center"
                              >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Refresh
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Token Refresh History</h3>
              
              {refreshHistory.length === 0 ? (
                <div className="text-center p-6 bg-gray-50 rounded-md">
                  <p className="text-gray-500">No token refresh history yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    History will be recorded when tokens are refreshed
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Platform
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ID
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Refreshed
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Current Expiry
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {refreshHistory.map((history, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {history.platformType === 'Facebook' ? (
                                <Facebook className="h-5 w-5 text-blue-600 mr-2" />
                              ) : (
                                <Instagram className="h-5 w-5 text-pink-600 mr-2" />
                              )}
                              <span className="text-sm text-gray-900">
                                {history.platformType}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {history.platformId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(history.lastRefreshed)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm ${getExpiryStatusClass(history.currentExpiry)}`}>
                              {formatDate(history.currentExpiry)}
                              <br />
                              <span className="text-xs">
                                {getExpiryStatus(history.currentExpiry)}
                              </span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Privacy and Data Management</h3>
              <p className="mt-2 text-sm text-gray-500">
                Manage your data and privacy settings. You can request deletion of your data at any time.
              </p>

              <div className="mt-6 border-t border-gray-200 pt-6">
                <h4 className="text-md font-medium text-gray-900">Data Deletion</h4>
                <p className="mt-2 text-sm text-gray-500">
                  You can request the deletion of all your data from our system. This action cannot be undone.
                </p>
                <div className="mt-4">
                  <button
                    onClick={handleDataDeletion}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete My Data
                  </button>
                </div>
              </div>

              <div className="mt-6 border-t border-gray-200 pt-6">
                <h4 className="text-md font-medium text-gray-900">Facebook Data Deletion</h4>
                <p className="mt-2 text-sm text-gray-500">
                  When you remove our app from your Facebook settings or remove access to your data in your Facebook account Settings, 
                  we automatically receive a data deletion request and will remove your Facebook-related data.
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  You can also visit your Facebook settings directly to manage app permissions:
                </p>
                <div className="mt-4">
                  <a
                    href="https://www.facebook.com/settings?tab=applications"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Facebook className="h-4 w-4 mr-2 text-blue-600" />
                    Manage Facebook Permissions
                  </a>
                </div>
              </div>

              <div className="mt-6 border-t border-gray-200 pt-6">
                <h4 className="text-md font-medium text-gray-900">Privacy Policy</h4>
                <p className="mt-2 text-sm text-gray-500">
                  Our privacy policy explains how we collect, use, and protect your data.
                </p>
                <div className="mt-4">
                  <a
                    href="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-500"
                  >
                    View Privacy Policy
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
