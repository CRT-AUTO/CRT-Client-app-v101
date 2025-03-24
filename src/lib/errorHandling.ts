import { useState, useEffect } from 'react';
import { captureError } from './sentry';

// Custom hook for error handling with automatic retry
export function useAsyncCall<T>(
  asyncFunction: (...args: any[]) => Promise<T>,
  initialState: T,
  maxRetries = 3,
  retryDelay = 1000
) {
  const [data, setData] = useState<T>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const execute = async (...args: any[]) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await asyncFunction(...args);
      setData(result);
      setLoading(false);
      setRetryCount(0); // Reset retry count on success
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Error in async call:', error);
      
      // If we haven't exceeded max retries, try again
      if (retryCount < maxRetries) {
        setRetryCount(prevCount => prevCount + 1);
        console.log(`Retrying (${retryCount + 1}/${maxRetries})...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Try again
        return execute(...args);
      }
      
      // Max retries exceeded, set error and report to Sentry in production
      setError(error);
      captureError(error, { context: 'useAsyncCall', args });
      setLoading(false);
      throw error;
    }
  };

  const reset = () => {
    setData(initialState);
    setLoading(false);
    setError(null);
    setRetryCount(0);
  };

  return { data, loading, error, execute, reset };
}

// Error boundary fallback component type
export interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

// Helper function to get user-friendly error messages
export function getUserFriendlyErrorMessage(error: Error): string {
  const message = error.message;
  
  // Check for specific error types
  if (message.includes('network') || message.includes('Network Error')) {
    return 'Network connection error. Please check your internet connection and try again.';
  }
  
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'The request took too long to complete. Please try again.';
  }
  
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'You have made too many requests. Please wait a moment and try again.';
  }
  
  if (message.includes('not authenticated') || message.includes('unauthorized')) {
    return 'Your session has expired. Please sign in again.';
  }
  
  if (message.includes('permission') || message.includes('forbidden')) {
    return 'You do not have permission to perform this action.';
  }
  
  // Default message
  return 'An unexpected error occurred. Please try again later.';
}

// Generic error handling for API calls
export async function withErrorHandling<T>(
  apiCall: () => Promise<T>,
  fallbackValue: T,
  customErrorMessage?: string
): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    console.error('API Error:', error);
    
    // Report to Sentry in production
    captureError(error, { 
      context: 'withErrorHandling',
      customErrorMessage 
    });
    
    if (customErrorMessage) {
      console.error(customErrorMessage);
    }
    
    return fallbackValue;
  }
}

// Debounce function for API calls
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

// Custom hook for handling loading states with timeout detection
export function useLoadingWithTimeout(timeout = 10000) {
  const [loading, setLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    if (loading) {
      setTimedOut(false);
      timeoutId = setTimeout(() => {
        setTimedOut(true);
      }, timeout);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading, timeout]);
  
  return { loading, setLoading, timedOut };
}