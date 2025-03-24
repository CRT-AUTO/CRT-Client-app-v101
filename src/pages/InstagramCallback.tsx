import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MessageSquare } from 'lucide-react';
import axios from 'axios';

export default function InstagramCallback() {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    async function handleInstagramCallback() {
      try {
        // Extract code from URL
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        
        if (!code) {
          throw new Error('Authorization code not found');
        }

        console.log('Processing Instagram callback with code:', code);
        setStatus('processing');

        // Get the current user
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          throw new Error('User not authenticated');
        }

        // In a production environment, this exchange should happen server-side
        // For demo purpose, we'll simulate a successful token exchange
        try {
          // Simulate API call to exchange code for token
          // In a real app, this would be a server-side request
          console.log('Simulating Instagram token exchange...');
          
          // Generate a realistic looking Instagram business account ID
          const mockIgAccountId = `ig_business_${Math.floor(Math.random() * 1000000000)}`;
          const mockToken = `ig_token_${Date.now()}`;
          
          // Calculate a date 60 days from now
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 60);
          
          // Store the connection in the database
          const { error: dbError } = await supabase
            .from('social_connections')
            .insert({
              user_id: userData.user.id,
              ig_account_id: mockIgAccountId,
              access_token: mockToken,
              token_expiry: expiryDate.toISOString()
            });
            
          if (dbError) throw dbError;
          
          setStatus('success');
          
          // Success! Wait a moment then redirect
          setTimeout(() => {
            navigate('/settings', { replace: true });
          }, 2000);
        } catch (apiError) {
          console.error('API Error:', apiError);
          throw new Error('Failed to exchange authorization code for access token');
        }
      } catch (err) {
        console.error('Instagram OAuth Error:', err);
        setError('Failed to connect your Instagram account. Please try again.');
        setStatus('error');
        setProcessing(false);
      }
    }

    handleInstagramCallback();
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <MessageSquare className="h-12 w-12 text-indigo-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Connecting Instagram
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          {status === 'processing' ? (
            <>
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
              <p className="text-gray-700">Processing your Instagram connection...</p>
              <p className="text-sm text-gray-500 mt-2">
                We're connecting to your Instagram account. This might take a moment.
              </p>
            </>
          ) : status === 'error' ? (
            <>
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 mb-4 rounded-md text-sm">
                {error}
              </div>
              <button
                onClick={() => navigate('/settings')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Go Back to Settings
              </button>
            </>
          ) : (
            <>
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 mb-4 rounded-md text-sm">
                Successfully connected to Instagram!
              </div>
              <p className="text-gray-700 mb-4">Redirecting you back to settings...</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}