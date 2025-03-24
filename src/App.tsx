import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { checkAndRefreshTokens } from './lib/tokenRefresh';
import { initVoiceflowConfig } from './lib/voiceflow';
import { isAdmin } from './lib/auth';
import Layout from './components/Layout';
import Auth from './components/Auth';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Messages from './pages/Messages';
import MessageDetail from './pages/MessageDetail';
import FacebookCallback from './pages/FacebookCallback';
import InstagramCallback from './pages/InstagramCallback';
import DeletionStatus from './pages/DeletionStatus';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUserManagement from './pages/admin/AdminUserManagement';
import AdminUserDetail from './pages/admin/AdminUserDetail';
import AdminWebhookSetup from './pages/admin/AdminWebhookSetup';
import AppErrorBoundary from './components/AppErrorBoundary';
import type { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenRefreshActive, setTokenRefreshActive] = useState(false);
  const [voiceflowInitialized, setVoiceflowInitialized] = useState(false);
  const [userIsAdmin, setUserIsAdmin] = useState(false);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      
      // If user is logged in, perform initialization steps
      if (session?.user) {
        // Check if user is an admin
        isAdmin().then(admin => {
          setUserIsAdmin(admin);
        });
        
        // Initialize Voiceflow configuration
        initVoiceflowConfig()
          .then(success => {
            setVoiceflowInitialized(success);
            console.log(`Voiceflow initialization ${success ? 'successful' : 'failed'}`);
          })
          .catch(err => {
            console.error('Error initializing Voiceflow:', err);
            setVoiceflowInitialized(false);
          });
        
        // Run token refresh immediately on login
        checkAndRefreshTokens()
          .then(() => console.log('Initial token refresh check completed'))
          .catch(err => console.error('Error during initial token refresh:', err));
        
        // Set up periodic token refresh checks
        if (!tokenRefreshActive) {
          setTokenRefreshActive(true);
          // Set up a timer to check for tokens that need refreshing every day
          const intervalId = setInterval(() => {
            console.log('Running scheduled token refresh check');
            checkAndRefreshTokens()
              .then(() => console.log('Scheduled token refresh check completed'))
              .catch(err => console.error('Error during scheduled token refresh:', err));
          }, 24 * 60 * 60 * 1000); // Check once a day
          
          // Clean up timer on unmount
          return () => {
            clearInterval(intervalId);
            setTokenRefreshActive(false);
          };
        }
      }
    });

    // Listen for changes on auth state (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      
      // If user changed, re-initialize Voiceflow
      if (newUser && (!user || newUser.id !== user.id)) {
        isAdmin().then(admin => {
          setUserIsAdmin(admin);
        });
        
        initVoiceflowConfig()
          .then(success => {
            setVoiceflowInitialized(success);
            console.log(`Voiceflow re-initialization ${success ? 'successful' : 'failed'}`);
          })
          .catch(err => {
            console.error('Error re-initializing Voiceflow:', err);
            setVoiceflowInitialized(false);
          });
      }
    });

    return () => subscription.unsubscribe();
  }, [tokenRefreshActive, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <Routes>
          {!user ? (
            <>
              <Route path="/auth" element={<Auth />} />
              {/* Public routes accessible without login */}
              <Route path="/deletion-status" element={<DeletionStatus />} />
              <Route path="*" element={<Navigate to="/auth" replace />} />
            </>
          ) : (
            <>
              <Route element={<Layout voiceflowInitialized={voiceflowInitialized} />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/messages/:id" element={<MessageDetail />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              
              {userIsAdmin && (
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUserManagement />} />
                  <Route path="users/:userId" element={<AdminUserDetail />} />
                  <Route path="webhooks" element={<AdminWebhookSetup />} />
                </Route>
              )}
              
              <Route path="/oauth/facebook/callback" element={<FacebookCallback />} />
              <Route path="/oauth/instagram/callback" element={<InstagramCallback />} />
              {/* Data deletion status page - accessible when logged in too */}
              <Route path="/deletion-status" element={<DeletionStatus />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;