import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Facebook, Instagram, Bot, ArrowLeft, Shield, Globe, Save, 
  MessageCircle, RefreshCw, AlertTriangle, Check, Link
} from 'lucide-react';
import { 
  getUserById, getVoiceflowMappingByUserId, getSocialConnectionsByUserId, 
  getWebhookConfigsByUserId, updateUserRole, createVoiceflowMapping, 
  updateVoiceflowMapping, createWebhookConfig, updateWebhookConfig,
  getConversationsByUserId, createVoiceflowApiKey, getVoiceflowApiKeyByUserId,
  updateVoiceflowApiKey
} from '../../lib/api';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorAlert from '../../components/ErrorAlert';
import RetryableErrorBoundary from '../../components/RetryableErrorBoundary';
import { VoiceflowMapping, WebhookConfig, Conversation, VoiceflowApiKey } from '../../types';

export default function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  
  const [userData, setUserData] = useState<any>(null);
  const [voiceflowMapping, setVoiceflowMapping] = useState<VoiceflowMapping | null>(null);
  const [webhookConfigs, setWebhookConfigs] = useState<WebhookConfig[]>([]);
  const [voiceflowApiKey, setVoiceflowApiKey] = useState<VoiceflowApiKey | null>(null);
  const [socialConnections, setSocialConnections] = useState<any[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [selectedRole, setSelectedRole] = useState('');
  const [voiceflowProjectId, setVoiceflowProjectId] = useState('');
  const [apiKeyValue, setApiKeyValue] = useState('');
  
  // Facebook webhook state
  const [fbWebhookUrl, setFbWebhookUrl] = useState('');
  const [fbVerificationToken, setFbVerificationToken] = useState('');
  const [fbGeneratedUrl, setFbGeneratedUrl] = useState('');
  const [fbWebhookName, setFbWebhookName] = useState('');
  const [isFbWebhookActive, setIsFbWebhookActive] = useState(false);
  
  // Instagram webhook state
  const [igWebhookUrl, setIgWebhookUrl] = useState('');
  const [igVerificationToken, setIgVerificationToken] = useState('');
  const [igGeneratedUrl, setIgGeneratedUrl] = useState('');
  const [igWebhookName, setIgWebhookName] = useState('');
  const [isIgWebhookActive, setIsIgWebhookActive] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [userRoleSaved, setUserRoleSaved] = useState(false);
  const [voiceflowSaved, setVoiceflowSaved] = useState(false);
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  
  useEffect(() => {
    if (!userId) return;
    
    loadUserData();
  }, [userId]);
  
  const loadUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load user data
      const user = await getUserById(userId!);
      setUserData(user);
      setSelectedRole(user.role || 'customer');
      
      // Load Voiceflow mapping
      const vfMapping = await getVoiceflowMappingByUserId(userId!);
      setVoiceflowMapping(vfMapping);
      if (vfMapping) {
        setVoiceflowProjectId(vfMapping.vf_project_id);
      }
      
      // Load Voiceflow API key
      const apiKey = await getVoiceflowApiKeyByUserId(userId!);
      setVoiceflowApiKey(apiKey);
      if (apiKey) {
        setApiKeyValue(apiKey.api_key);
      }
      
      // Load webhook configs
      const webhooks = await getWebhookConfigsByUserId(userId!);
      setWebhookConfigs(webhooks);
      
      // Initialize Facebook webhook form fields
      const fbWebhook = webhooks.find(w => w.platform === 'facebook');
      if (fbWebhook) {
        setFbWebhookUrl(fbWebhook.webhook_url || '');
        setFbVerificationToken(fbWebhook.verification_token || '');
        setFbGeneratedUrl(fbWebhook.generated_url || '');
        setFbWebhookName(fbWebhook.webhook_name || '');
        setIsFbWebhookActive(fbWebhook.is_active);
      }
      
      // Initialize Instagram webhook form fields
      const igWebhook = webhooks.find(w => w.platform === 'instagram');
      if (igWebhook) {
        setIgWebhookUrl(igWebhook.webhook_url || '');
        setIgVerificationToken(igWebhook.verification_token || '');
        setIgGeneratedUrl(igWebhook.generated_url || '');
        setIgWebhookName(igWebhook.webhook_name || '');
        setIsIgWebhookActive(igWebhook.is_active);
      }
      
      // Load social connections
      const connections = await getSocialConnectionsByUserId(userId!);
      setSocialConnections(connections);
      
      // Load conversations
      const userConversations = await getConversationsByUserId(userId!);
      setConversations(userConversations);
      
    } catch (err) {
      console.error('Error loading user data:', err);
      setError('Failed to load user data. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveUserRole = async () => {
    if (!userId) return;
    
    try {
      setSaving(true);
      await updateUserRole(userId, selectedRole);
      
      // Update local user data
      setUserData(prev => ({
        ...prev,
        role: selectedRole
      }));
      
      setUserRoleSaved(true);
      setTimeout(() => setUserRoleSaved(false), 3000);
    } catch (err) {
      console.error('Error updating user role:', err);
      setError('Failed to update user role. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const handleSaveVoiceflow = async () => {
    if (!userId || !voiceflowProjectId) return;
    
    try {
      setSaving(true);
      
      const flowbridgeConfig = {
        client_id: userId,
        voiceflow: {
          project_id: voiceflowProjectId,
          version_id: "latest"
        }
      };
      
      if (voiceflowMapping) {
        // Update existing mapping
        const updated = await updateVoiceflowMapping(voiceflowMapping.id, {
          vf_project_id: voiceflowProjectId,
          flowbridge_config: flowbridgeConfig
        });
        setVoiceflowMapping(updated);
      } else {
        // Create new mapping
        const newMapping = await createVoiceflowMapping({
          user_id: userId,
          vf_project_id: voiceflowProjectId,
          flowbridge_config: flowbridgeConfig
        });
        setVoiceflowMapping(newMapping);
      }
      
      setVoiceflowSaved(true);
      setTimeout(() => setVoiceflowSaved(false), 3000);
    } catch (err) {
      console.error('Error saving Voiceflow mapping:', err);
      setError('Failed to save Voiceflow configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const handleSaveApiKey = async () => {
    if (!userId || !apiKeyValue) return;
    
    try {
      setSaving(true);
      
      if (voiceflowApiKey) {
        // Update existing API key
        const updated = await updateVoiceflowApiKey(voiceflowApiKey.id, {
          api_key: apiKeyValue
        });
        setVoiceflowApiKey(updated);
      } else {
        // Create new API key
        const newApiKey = await createVoiceflowApiKey({
          user_id: userId,
          api_key: apiKeyValue
        });
        setVoiceflowApiKey(newApiKey);
      }
      
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 3000);
    } catch (err) {
      console.error('Error saving Voiceflow API key:', err);
      setError('Failed to save API key. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const handleSaveFacebookWebhook = async () => {
    if (!userId) return;
    
    try {
      setSaving(true);
      
      // Find existing webhook config
      const existingWebhook = webhookConfigs.find(w => w.platform === 'facebook');
      
      if (existingWebhook) {
        // Update existing webhook config
        const updated = await updateWebhookConfig(existingWebhook.id, {
          webhook_url: fbWebhookUrl,
          verification_token: fbVerificationToken,
          generated_url: fbGeneratedUrl,
          webhook_name: fbWebhookName,
          is_active: isFbWebhookActive
        });
        
        // Update the webhooks list
        setWebhookConfigs(prev => prev.map(w => 
          w.id === existingWebhook.id ? updated : w
        ));
      } else {
        // Create new webhook config
        const newConfig = await createWebhookConfig({
          user_id: userId,
          webhook_url: fbWebhookUrl,
          verification_token: fbVerificationToken,
          generated_url: fbGeneratedUrl,
          webhook_name: fbWebhookName,
          is_active: isFbWebhookActive,
          platform: 'facebook'
        });
        
        // Add to webhooks list
        setWebhookConfigs(prev => [...prev, newConfig]);
      }
      
      setWebhookSaved(true);
      setTimeout(() => setWebhookSaved(false), 3000);
    } catch (err) {
      console.error('Error saving Facebook webhook configuration:', err);
      setError('Failed to save Facebook webhook configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const handleSaveInstagramWebhook = async () => {
    if (!userId) return;
    
    try {
      setSaving(true);
      
      // Find existing webhook config
      const existingWebhook = webhookConfigs.find(w => w.platform === 'instagram');
      
      if (existingWebhook) {
        // Update existing webhook config
        const updated = await updateWebhookConfig(existingWebhook.id, {
          webhook_url: igWebhookUrl,
          verification_token: igVerificationToken,
          generated_url: igGeneratedUrl,
          webhook_name: igWebhookName,
          is_active: isIgWebhookActive
        });
        
        // Update the webhooks list
        setWebhookConfigs(prev => prev.map(w => 
          w.id === existingWebhook.id ? updated : w
        ));
      } else {
        // Create new webhook config
        const newConfig = await createWebhookConfig({
          user_id: userId,
          webhook_url: igWebhookUrl,
          verification_token: igVerificationToken,
          generated_url: igGeneratedUrl,
          webhook_name: igWebhookName,
          is_active: isIgWebhookActive,
          platform: 'instagram'
        });
        
        // Add to webhooks list
        setWebhookConfigs(prev => [...prev, newConfig]);
      }
      
      setWebhookSaved(true);
      setTimeout(() => setWebhookSaved(false), 3000);
    } catch (err) {
      console.error('Error saving Instagram webhook configuration:', err);
      setError('Failed to save Instagram webhook configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const generateRandomToken = () => {
    const randomBytes = new Uint8Array(20);
    window.crypto.getRandomValues(randomBytes);
    const token = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return token;
  };
  
  const generateFacebookToken = () => {
    setFbVerificationToken(generateRandomToken());
  };
  
  const generateInstagramToken = () => {
    setIgVerificationToken(generateRandomToken());
  };
  
  const generateFacebookWebhookUrl = () => {
    const baseUrl = window.location.origin;
    const timestamp = Date.now();
    const generatedUrl = `${baseUrl}/api/webhooks/${userId}/facebook/${timestamp}`;
    setFbGeneratedUrl(generatedUrl);
  };
  
  const generateInstagramWebhookUrl = () => {
    const baseUrl = window.location.origin;
    const timestamp = Date.now();
    const generatedUrl = `${baseUrl}/api/webhooks/${userId}/instagram/${timestamp}`;
    setIgGeneratedUrl(generatedUrl);
  };

  if (loading) {
    return <LoadingIndicator message="Loading user details..." />;
  }
  
  if (!userData) {
    return (
      <div className="bg-white shadow rounded-lg p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">User Not Found</h3>
        <p className="text-gray-500 mb-4">
          Could not find user with ID: {userId}
        </p>
        <button
          onClick={() => navigate('/admin/users')}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to User Management
        </button>
      </div>
    );
  }
  
  const facebookConnection = socialConnections.find(conn => conn.fb_page_id);
  const instagramConnection = socialConnections.find(conn => conn.ig_account_id);
  
  return (
    <RetryableErrorBoundary onRetry={loadUserData}>
      <div className="space-y-6">
        {error && (
          <ErrorAlert 
            message="Error" 
            details={error} 
            onDismiss={() => setError(null)} 
          />
        )}
        
        {/* Back button */}
        <div>
          <button
            onClick={() => navigate('/admin/users')}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to User List
          </button>
        </div>
        
        {/* User Info Card */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">User Information</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">Personal details and application settings.</p>
            </div>
            <div className="flex items-center">
              <button
                onClick={loadUserData}
                className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm leading-5 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </button>
            </div>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl className="sm:divide-y sm:divide-gray-200">
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <User className="h-5 w-5 mr-2 text-gray-400" />
                  Email
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{userData.email}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-gray-400" />
                  User Role
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <div className="flex items-center">
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="mr-3 max-w-xs block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md"
                    >
                      <option value="admin">Admin</option>
                      <option value="customer">Customer</option>
                    </select>
                    
                    <button
                      onClick={handleSaveUserRole}
                      disabled={selectedRole === userData.role || saving}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      {saving ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {saving ? 'Saving...' : 'Update Role'}
                    </button>
                    
                    {userRoleSaved && (
                      <span className="ml-3 text-sm text-green-600 flex items-center">
                        <Check className="h-4 w-4 mr-1" />
                        Role updated
                      </span>
                    )}
                  </div>
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Facebook className="h-5 w-5 mr-2 text-blue-500" />
                  Facebook Connection
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {facebookConnection ? (
                    <div>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Connected
                      </span>
                      <p className="mt-1">
                        Page ID: {facebookConnection.fb_page_id}
                      </p>
                      <p className="text-xs text-gray-500">
                        Token expires: {new Date(facebookConnection.token_expiry).toLocaleDateString()}
                      </p>
                    </div>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                      Not Connected
                    </span>
                  )}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Instagram className="h-5 w-5 mr-2 text-pink-500" />
                  Instagram Connection
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {instagramConnection ? (
                    <div>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Connected
                      </span>
                      <p className="mt-1">
                        Account ID: {instagramConnection.ig_account_id}
                      </p>
                      <p className="text-xs text-gray-500">
                        Token expires: {new Date(instagramConnection.token_expiry).toLocaleDateString()}
                      </p>
                    </div>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                      Not Connected
                    </span>
                  )}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <MessageCircle className="h-5 w-5 mr-2 text-indigo-500" />
                  Activity
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <p>Conversations: {conversations.length}</p>
                  <p className="mt-1">
                    Messages: {conversations.reduce((sum, conv) => sum + (conv.latest_message ? 1 : 0), 0)}
                  </p>
                </dd>
              </div>
            </dl>
          </div>
        </div>
        
        {/* Voiceflow Configuration Card */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
              <Bot className="h-6 w-6 mr-2 text-indigo-600" />
              Voiceflow Configuration
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Configure the Voiceflow agent for this user.
            </p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            <div className="space-y-6">
              <div>
                <label htmlFor="voiceflow-project-id" className="block text-sm font-medium text-gray-700">
                  Voiceflow Project ID
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="voiceflow-project-id"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={voiceflowProjectId}
                    onChange={(e) => setVoiceflowProjectId(e.target.value)}
                    placeholder="Enter Voiceflow project ID"
                  />
                </div>
                {voiceflowMapping && (
                  <p className="mt-2 text-sm text-green-600">This user already has a Voiceflow project configured.</p>
                )}
              </div>
              
              <div>
                <label htmlFor="voiceflow-api-key" className="block text-sm font-medium text-gray-700">
                  Voiceflow API Key
                </label>
                <div className="mt-1">
                  <input
                    type="password"
                    id="voiceflow-api-key"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={apiKeyValue}
                    onChange={(e) => setApiKeyValue(e.target.value)}
                    placeholder="Enter Voiceflow API key"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  This API key will be used to access Voiceflow endpoints for the knowledge base and other features.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0">
                <button
                  onClick={handleSaveVoiceflow}
                  disabled={!voiceflowProjectId || saving}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving ? 'Saving...' : voiceflowMapping ? 'Update Project' : 'Save Project'}
                </button>
                
                <button
                  onClick={handleSaveApiKey}
                  disabled={!apiKeyValue || saving}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving ? 'Saving...' : voiceflowApiKey ? 'Update API Key' : 'Save API Key'}
                </button>
                
                {(voiceflowSaved || apiKeySaved) && (
                  <span className="inline-flex items-center text-sm text-green-600">
                    <Check className="h-4 w-4 mr-1" />
                    {voiceflowSaved ? 'Project configuration saved' : 'API key saved'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Facebook Webhook Configuration Card */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
              <Facebook className="h-6 w-6 mr-2 text-blue-600" />
              Facebook Webhook Configuration
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Configure webhooks for receiving messages from Facebook.
            </p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            <div className="space-y-6">
              <div>
                <label htmlFor="fb-webhook-name" className="block text-sm font-medium text-gray-700">
                  Webhook Name
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="fb-webhook-name"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={fbWebhookName}
                    onChange={(e) => setFbWebhookName(e.target.value)}
                    placeholder="Facebook Messages"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  A descriptive name for this webhook configuration.
                </p>
              </div>
              
              <div>
                <label htmlFor="fb-webhook-url" className="block text-sm font-medium text-gray-700">
                  Custom Webhook URL
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="fb-webhook-url"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={fbWebhookUrl}
                    onChange={(e) => setFbWebhookUrl(e.target.value)}
                    placeholder="https://example.com/webhooks/facebook"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  The URL where Meta will send Facebook webhook events for this user (optional).
                </p>
              </div>
              
              <div>
                <label htmlFor="fb-generated-url" className="block text-sm font-medium text-gray-700">
                  Generated Webhook URL
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="text"
                    id="fb-generated-url"
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300"
                    value={fbGeneratedUrl}
                    onChange={(e) => setFbGeneratedUrl(e.target.value)}
                    placeholder="No URL generated yet"
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={generateFacebookWebhookUrl}
                    className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-700 text-sm"
                  >
                    <Link className="h-4 w-4 mr-1" />
                    Generate
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  System-generated URL that can be used as the webhook callback URL.
                </p>
              </div>
              
              <div>
                <label htmlFor="fb-verification-token" className="block text-sm font-medium text-gray-700">
                  Verification Token
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="text"
                    id="fb-verification-token"
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300"
                    value={fbVerificationToken}
                    onChange={(e) => setFbVerificationToken(e.target.value)}
                    placeholder="Enter verification token"
                  />
                  <button
                    type="button"
                    onClick={generateFacebookToken}
                    className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-700 text-sm"
                  >
                    Generate
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  This token will be used to verify webhook requests from Meta.
                </p>
              </div>
              
              <div className="relative flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="fb-webhook-active"
                    name="fb-webhook-active"
                    type="checkbox"
                    checked={isFbWebhookActive}
                    onChange={() => setIsFbWebhookActive(!isFbWebhookActive)}
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="fb-webhook-active" className="font-medium text-gray-700">
                    Active
                  </label>
                  <p className="text-gray-500">Enable webhook to receive messages from Facebook.</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <button
                  onClick={handleSaveFacebookWebhook}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving ? 'Saving...' : webhookConfigs.find(w => w.platform === 'facebook') ? 'Update Facebook Webhook' : 'Save Facebook Webhook'}
                </button>
                
                {webhookSaved && (
                  <span className="ml-3 text-sm text-green-600 flex items-center">
                    <Check className="h-4 w-4 mr-1" />
                    Webhook configuration saved
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Instagram Webhook Configuration Card */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
              <Instagram className="h-6 w-6 mr-2 text-pink-600" />
              Instagram Webhook Configuration
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Configure webhooks for receiving messages from Instagram.
            </p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            <div className="space-y-6">
              <div>
                <label htmlFor="ig-webhook-name" className="block text-sm font-medium text-gray-700">
                  Webhook Name
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="ig-webhook-name"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={igWebhookName}
                    onChange={(e) => setIgWebhookName(e.target.value)}
                    placeholder="Instagram Messages"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  A descriptive name for this webhook configuration.
                </p>
              </div>
              
              <div>
                <label htmlFor="ig-webhook-url" className="block text-sm font-medium text-gray-700">
                  Custom Webhook URL
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="ig-webhook-url"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={igWebhookUrl}
                    onChange={(e) => setIgWebhookUrl(e.target.value)}
                    placeholder="https://example.com/webhooks/instagram"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  The URL where Meta will send Instagram webhook events for this user (optional).
                </p>
              </div>
              
              <div>
                <label htmlFor="ig-generated-url" className="block text-sm font-medium text-gray-700">
                  Generated Webhook URL
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="text"
                    id="ig-generated-url"
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300"
                    value={igGeneratedUrl}
                    onChange={(e) => setIgGeneratedUrl(e.target.value)}
                    placeholder="No URL generated yet"
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={generateInstagramWebhookUrl}
                    className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-700 text-sm"
                  >
                    <Link className="h-4 w-4 mr-1" />
                    Generate
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  System-generated URL that can be used as the webhook callback URL.
                </p>
              </div>
              
              <div>
                <label htmlFor="ig-verification-token" className="block text-sm font-medium text-gray-700">
                  Verification Token
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="text"
                    id="ig-verification-token"
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300"
                    value={igVerificationToken}
                    onChange={(e) => setIgVerificationToken(e.target.value)}
                    placeholder="Enter verification token"
                  />
                  <button
                    type="button"
                    onClick={generateInstagramToken}
                    className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-700 text-sm"
                  >
                    Generate
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  This token will be used to verify webhook requests from Meta.
                </p>
              </div>
              
              <div className="relative flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="ig-webhook-active"
                    name="ig-webhook-active"
                    type="checkbox"
                    checked={isIgWebhookActive}
                    onChange={() => setIsIgWebhookActive(!isIgWebhookActive)}
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="ig-webhook-active" className="font-medium text-gray-700">
                    Active
                  </label>
                  <p className="text-gray-500">Enable webhook to receive messages from Instagram.</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <button
                  onClick={handleSaveInstagramWebhook}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving ? 'Saving...' : webhookConfigs.find(w => w.platform === 'instagram') ? 'Update Instagram Webhook' : 'Save Instagram Webhook'}
                </button>
                
                {webhookSaved && (
                  <span className="ml-3 text-sm text-green-600 flex items-center">
                    <Check className="h-4 w-4 mr-1" />
                    Webhook configuration saved
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </RetryableErrorBoundary>
  );
}