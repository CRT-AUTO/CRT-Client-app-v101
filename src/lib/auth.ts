import { supabase } from './supabase';
import { User } from '../types';

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    
    if (error || !data.user) {
      console.error('Error getting current user:', error);
      return null;
    }
    
    // Ensure the user exists in the public.users table
    try {
      await ensureUserExists(data.user.id, data.user.email || '');
    } catch (err) {
      // Log the error but don't stop the process
      console.error('Error ensuring user exists:', err);
      // If we can't ensure the user exists, we'll still try to return the basic user
    }
    
    // Get additional user data from the database
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();
        
      if (userError) {
        console.error('Error getting user role:', userError);
        // Don't throw here, just return basic user data
      }
      
      return {
        id: data.user.id,
        email: data.user.email || '',
        role: userData?.role || 'customer',
        created_at: data.user.created_at || new Date().toISOString()
      };
    } catch (error) {
      console.error('Error in getCurrentUser:', error);
      // Return basic user without role
      return {
        id: data.user.id,
        email: data.user.email || '',
        role: 'customer', // Default role
        created_at: data.user.created_at || new Date().toISOString()
      };
    }
  } catch (error) {
    console.error('Unexpected error in getCurrentUser:', error);
    return null;
  }
}

// Helper function to ensure a user exists in the public.users table
async function ensureUserExists(userId: string, email: string): Promise<void> {
  try {
    // First check if the user is authenticated
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      // User is not authenticated, don't try to access the database
      console.log('User not authenticated, skipping user record creation');
      return;
    }
    
    // Check if user exists in public.users table
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
      
    // If there's no user record, create one
    if (!data || error) {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: email,
          role: 'customer',
          created_at: new Date().toISOString()
        });
        
      if (insertError) {
        console.error('Error creating user record:', insertError);
        throw insertError;
      }
    }
  } catch (error) {
    console.error('Error ensuring user exists:', error);
    throw error;
  }
}

export async function isAdmin(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;
    
    return user.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

// Function to logout the current user
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error logging out:', error);
    throw error;
  }
}