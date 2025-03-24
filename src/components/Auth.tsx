import React, { useState, useEffect } from 'react';
import { MessageSquare, Facebook } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { checkFacebookLoginStatus, handleFacebookStatusChange, loginWithFacebook } from '../lib/facebookAuth';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [fbLoading, setFbLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fbButtonRendered, setFbButtonRendered] = useState(false);
  const [useFallbackButton, setUseFallbackButton] = useState(true); // Always use fallback button
  
  // Check Facebook login status when component loads
  useEffect(() => {
    const checkFbStatus = async () => {
      try {
        // Only proceed if FB SDK is loaded
        if (typeof FB !== 'undefined') {
          const response = await checkFacebookLoginStatus();
          if (response.status === 'connected') {
            // User is already logged in to Facebook and authorized the app
            setFbLoading(true);
            const success = await handleFacebookStatusChange(response);
            if (success) {
              // If FB login was successful, we could redirect or update UI
              console.log('User already authenticated with Facebook');
            }
            setFbLoading(false);
          }
        }
      } catch (err) {
        console.error('Error checking Facebook status:', err);
      }
    };
    
    // Check for FB SDK
    const checkFbSdk = () => {
      if (typeof FB !== 'undefined') {
        // Facebook SDK is loaded
        checkFbStatus();
        setFbButtonRendered(true);
        return true;
      }
      return false;
    };
    
    // Try immediately
    if (!checkFbSdk()) {
      // If not ready, set up a listener for when it initializes
      const originalFbInit = window.fbAsyncInit;
      window.fbAsyncInit = function() {
        if (originalFbInit) originalFbInit();
        
        // Now that FB SDK is initialized, check status
        FB.init({
          appId: import.meta.env.VITE_META_APP_ID,
          cookie: true,
          xfbml: true,
          version: 'v22.0'
        });
        
        checkFbStatus();
        setFbButtonRendered(true);
      };
    }
  }, [fbButtonRendered]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  const handleFacebookLogin = async () => {
    setFbLoading(true);
    setError(null);
    
    try {
      const response = await loginWithFacebook();
      const success = await handleFacebookStatusChange(response);
      
      if (!success) {
        setError('Facebook login was not successful');
      }
    } catch (err) {
      console.error('Facebook login error:', err);
      setError(err instanceof Error ? err.message : 'Facebook login failed');
    } finally {
      setFbLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <MessageSquare className="h-12 w-12 text-indigo-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {isSignUp ? 'Create your account' : 'Sign in to your account'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              {/* Single Facebook button implementation */}
              <button
                onClick={handleFacebookLogin}
                disabled={fbLoading}
                className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-white bg-[#1877F2] hover:bg-[#166FE5] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1877F2] disabled:opacity-50"
              >
                {fbLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Facebook className="h-5 w-5 mr-2" />
                )}
                {fbLoading ? 'Processing...' : 'Continue with Facebook'}
              </button>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="w-full text-center text-sm text-indigo-600 hover:text-indigo-500"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}