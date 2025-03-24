import React, { useEffect, useRef } from 'react';
import { handleFacebookStatusChange } from '../lib/facebookAuth';

interface FacebookLoginButtonProps {
  onLoginSuccess?: () => void;
  onLoginFailure?: (error: string) => void;
  scope?: string;
  autoLogoutLink?: boolean;
  width?: string;
}

declare global {
  interface Window {
    checkLoginState: () => void;
    FB: any;
    fbAsyncInit: any;
  }
}

const FacebookLoginButton: React.FC<FacebookLoginButtonProps> = ({
  onLoginSuccess,
  onLoginFailure,
  scope = "public_profile,email",
  autoLogoutLink = false,
  width = "300px"
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const buttonId = `fb-button-${Math.random().toString(36).substring(2, 10)}`;

  // This function will be called by the Facebook login button
  useEffect(() => {
    // Define the global callback function that the FB button will call
    window.checkLoginState = function() {
      if (typeof FB !== 'undefined') {
        FB.getLoginStatus(function(response: any) {
          statusChangeCallback(response);
        });
      } else {
        console.error("Facebook SDK not initialized");
        if (onLoginFailure) onLoginFailure("Facebook SDK not initialized");
      }
    };

    // Process the login status
    const statusChangeCallback = async (response: any) => {
      console.log('statusChangeCallback response:', response);
      
      try {
        const success = await handleFacebookStatusChange(response);
        if (success && onLoginSuccess) {
          onLoginSuccess();
        } else if (!success && onLoginFailure) {
          onLoginFailure('Login was not successful');
        }
      } catch (error) {
        console.error('Error handling Facebook status change:', error);
        if (onLoginFailure) {
          onLoginFailure(error instanceof Error ? error.message : 'Unknown error occurred');
        }
      }
    };

    // Let FB SDK parse and render the button when loaded
    const checkFBInterval = setInterval(() => {
      if (typeof FB !== 'undefined' && buttonRef.current) {
        console.log("Parsing XFBML for Facebook login button");
        try {
          // Remove any existing button first to prevent duplication
          const existingButtons = buttonRef.current.querySelectorAll('.fb-login-button');
          existingButtons.forEach(button => {
            if (button.id !== buttonId) {
              button.remove();
            }
          });
          
          // Then parse the XFBML
          FB.XFBML.parse(buttonRef.current);
        } catch (e) {
          console.error("Error parsing XFBML:", e);
        }
        clearInterval(checkFBInterval);
      }
    }, 500);
    
    // Cleanup interval after 10 seconds to prevent memory leaks
    setTimeout(() => clearInterval(checkFBInterval), 10000);

    // Cleanup function
    return () => {
      clearInterval(checkFBInterval);
      // Keep the global checkLoginState function as other buttons might need it
    };
  }, [scope, onLoginSuccess, onLoginFailure, buttonId]);

  return (
    <div className="facebook-login-container" ref={buttonRef}>
      <div 
        id={buttonId}
        className="fb-login-button" 
        data-width={width}
        data-size="large"
        data-button-type="continue_with"
        data-layout="rounded"
        data-auto-logout-link={autoLogoutLink ? "true" : "false"}
        data-use-continue-as="false"
        data-scope={scope}
        data-onlogin="checkLoginState();"
      ></div>
    </div>
  );
};

export default FacebookLoginButton;