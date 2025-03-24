import React, { useState, useEffect } from 'react';
import { Webhook, RefreshCw, Copy, Check, AlertTriangle, Globe, Link } from 'lucide-react';
import { getWebhookConfigs, getUserById, updateWebhookConfig } from '../../lib/api';
import { WebhookConfig } from '../../types';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorAlert from '../../components/ErrorAlert';

export default function AdminWebhookSetup() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const webhookConfigs = await getWebhookConfigs();
      setWebhooks(webhookConfigs);
      
      // Load user emails for each webhook
      const userInfo: Record<string, string> = {};
      for (const webhook of webhookConfigs) {
        try {
          const user = await getUserById(webhook.user_id);
          userInfo[webhook.user_id] = user.email;
        } catch (err) {
          console.error(`Error loading user for webhook ${webhook.id}:`, err);
          userInfo[webhook.user_id] = 'Unknown User';
        }
      }
      setUserMap(userInfo);
      
      setError(null);
    } catch (err) {
      console.error('Error loading webhook configs:', err);
      setError('Failed to load webhook configurations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(id);
        setTimeout(() => setCopied(null), 3000);
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  };
  
  const generateWebhookUrl = async (webhook: WebhookConfig) => {
    try {
      // Generate a unique URL based on the user ID and platform
      const baseUrl = window.location.origin;
      const platform = webhook.platform || 'all';
      const generatedUrl = `${baseUrl}/api/webhooks/${webhook.user_id}/${platform}/${Date.now()}`;
      
      // Update the webhook config with the generated URL
      await updateWebhookConfig(webhook.id, { 
        generated_url: generatedUrl 
      });
      
      // Refresh the data
      await loadData();
    } catch (err) {
      console.error('Error generating webhook URL:', err);
      setError('Failed to generate webhook URL');
    }
  };

  if (loading) {
    return <LoadingIndicator message="Loading webhook configurations..." />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <ErrorAlert 
          message="Error" 
          details={error} 
          onDismiss={() => setError(null)} 
        />
      )}
      
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-700">Webhook Configurations</h2>
          <p className="text-gray-500">Configure and manage webhooks for Meta platforms</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {refreshing ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </button>
      </div>
      
      {/* Setup Instructions */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 flex items-center">
          <Webhook className="h-6 w-6 text-indigo-600 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-gray-900">Meta Webhook Setup Instructions</h3>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
          <div className="prose max-w-none">
            <p>
              To set up Meta webhooks for your customers, follow these steps:
            </p>
            
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                Go to the <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-500">Meta Developers Portal</a> and select your app.
              </li>
              <li>
                Navigate to "Webhooks" in the sidebar and click "Add Subscription".
              </li>
              <li>
                Select the appropriate webhook for the platform (Facebook Page or Instagram).
              </li>
              <li>
                Enter the Callback URL for the user (shown in the table below).
              </li>
              <li>
                Enter the Verification Token for the user (shown in the table below).
              </li>
              <li>
                Select the appropriate webhook fields:
                <ul className="list-disc pl-5 mt-1">
                  <li>For Facebook Pages: <code>messages, messaging_postbacks, message_deliveries, message_reads</code></li>
                  <li>For Instagram: <code>messages, messaging_postbacks</code></li>
                </ul>
              </li>
              <li>
                Click "Verify and Save" to complete the webhook setup.
              </li>
            </ol>
            
            <div className="mt-4 p-4 bg-yellow-50 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Important Notes</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Configure separate webhooks for Facebook and Instagram platforms.</li>
                      <li>Make sure the webhook is marked as "Active" in the user's configuration.</li>
                      <li>Webhooks will only work for users who have connected their Facebook or Instagram accounts.</li>
                      <li>You can generate webhook URLs if the user hasn't provided their own.</li>
                      <li>You need to configure appropriate permissions for your Meta app.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Webhook Configurations Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            {webhooks.length > 0 
              ? `Configured Webhooks (${webhooks.length})` 
              : 'No Webhooks Configured'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Active webhooks for your users
          </p>
        </div>
        
        {webhooks.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status / Platform
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Webhook URL
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Generated URL
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Verification Token
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {webhooks.map(webhook => (
                  <tr key={webhook.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {userMap[webhook.user_id] || webhook.user_id}
                      </div>
                      <div className="text-xs text-gray-500">
                        {webhook.user_id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        {webhook.is_active ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            Inactive
                          </span>
                        )}
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {webhook.platform || 'all'}
                        </span>
                        {webhook.webhook_name && (
                          <span className="text-xs text-gray-500 truncate max-w-[100px]">
                            {webhook.webhook_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center max-w-xs">
                        <div className="truncate text-sm text-gray-900">
                          {webhook.webhook_url || "Not configured"}
                        </div>
                        {webhook.webhook_url && (
                          <button
                            onClick={() => copyToClipboard(webhook.webhook_url || "", `url-${webhook.id}`)}
                            className="ml-2 text-gray-400 hover:text-gray-600"
                          >
                            {copied === `url-${webhook.id}` ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center max-w-xs">
                        <div className="truncate text-sm text-gray-900">
                          {webhook.generated_url || "Not generated"}
                        </div>
                        {webhook.generated_url ? (
                          <button
                            onClick={() => copyToClipboard(webhook.generated_url || "", `gen-${webhook.id}`)}
                            className="ml-2 text-gray-400 hover:text-gray-600"
                          >
                            {copied === `gen-${webhook.id}` ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => generateWebhookUrl(webhook)}
                            className="ml-2 text-indigo-600 hover:text-indigo-700"
                            title="Generate URL"
                          >
                            <Link className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm text-gray-900 font-mono">
                          {webhook.verification_token 
                            ? `${webhook.verification_token.slice(0, 8)}...` 
                            : "Not configured"}
                        </div>
                        {webhook.verification_token && (
                          <button
                            onClick={() => copyToClipboard(webhook.verification_token || "", `token-${webhook.id}`)}
                            className="ml-2 text-gray-400 hover:text-gray-600"
                          >
                            {copied === `token-${webhook.id}` ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <a
                        href={`/admin/users/${webhook.user_id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Manage User
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {webhooks.length === 0 && (
          <div className="px-4 py-12 text-center border-t border-gray-200">
            <Webhook className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No webhooks configured</h3>
            <p className="mt-1 text-sm text-gray-500">
              Configure webhooks for your users on their individual user detail pages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}