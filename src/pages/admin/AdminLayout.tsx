import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, Users, MessageSquare, Webhook, LogOut, LayoutDashboard } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-gray-900 text-white overflow-y-auto">
        <div className="flex items-center justify-center h-16 bg-gray-800">
          <ShieldCheck className="h-8 w-8 text-red-500" />
          <span className="ml-2 text-xl font-bold">Admin Portal</span>
        </div>
        <nav className="mt-5">
          <Link
            to="/admin"
            className={`${
              location.pathname === '/admin'
                ? 'bg-gray-800 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            } flex items-center px-4 py-3 text-sm font-medium transition-colors duration-200`}
          >
            <LayoutDashboard className="h-5 w-5 mr-3" />
            Dashboard
          </Link>
          <Link
            to="/admin/users"
            className={`${
              location.pathname.startsWith('/admin/users')
                ? 'bg-gray-800 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            } flex items-center px-4 py-3 text-sm font-medium transition-colors duration-200`}
          >
            <Users className="h-5 w-5 mr-3" />
            User Management
          </Link>
          <Link
            to="/admin/webhooks"
            className={`${
              location.pathname === '/admin/webhooks'
                ? 'bg-gray-800 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            } flex items-center px-4 py-3 text-sm font-medium transition-colors duration-200`}
          >
            <Webhook className="h-5 w-5 mr-3" />
            Webhook Setup
          </Link>
          
          <div className="px-4 py-6">
            <hr className="border-gray-700" />
          </div>
          
          <Link
            to="/dashboard"
            className="text-gray-300 hover:bg-gray-700 hover:text-white flex items-center px-4 py-3 text-sm font-medium transition-colors duration-200"
          >
            <MessageSquare className="h-5 w-5 mr-3" />
            Exit Admin Portal
          </Link>
          
          <button
            onClick={handleSignOut}
            className="w-full text-left text-gray-300 hover:bg-gray-700 hover:text-white flex items-center px-4 py-3 text-sm font-medium transition-colors duration-200"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Sign Out
          </button>
        </nav>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <header className="bg-white shadow">
          <div className="mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold text-gray-900">
              {location.pathname === '/admin' && 'Admin Dashboard'}
              {location.pathname === '/admin/users' && 'User Management'}
              {location.pathname.match(/\/admin\/users\/[^/]+/) && 'User Detail'}
              {location.pathname === '/admin/webhooks' && 'Webhook Configuration'}
            </h1>
          </div>
        </header>
        <main>
          <div className="mx-auto py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}