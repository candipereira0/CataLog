import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          prompt: (momentListener?: unknown) => void;
          renderButton: (
            element: HTMLElement,
            options: { theme?: string; size?: string; type?: string; shape?: string; width?: number }
          ) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export default function GoogleSignInButton() {
  const { googleLogin } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  const googleClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || "";

  const handleGoogleResponse = useCallback(
    async (response: { credential: string }) => {
      setError("");
      setLoading(true);
      try {
        await googleLogin(response.credential);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Google sign-in failed");
      } finally {
        setLoading(false);
      }
    },
    [googleLogin]
  );

  // Real Google Sign-In flow
  useEffect(() => {
    if (!googleClientId || scriptLoaded.current) return;

    // Load Google Identity Services script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoaded.current = true;
      if (window.google && buttonRef.current) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleResponse,
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "filled_black",
          size: "large",
          type: "standard",
          shape: "rectangular",
          width: 400,
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [googleClientId, handleGoogleResponse]);

  // Mock mode
  const handleMockLogin = async () => {
    setError("");
    setLoading(true);
    try {
      // Send a mock credential — backend will create a demo user
      await googleLogin("mock-google-demo@catalog.app|Google DJ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full py-3 flex items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-800" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-gray-900 px-3 text-gray-500">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/30 border border-red-800 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {googleClientId ? (
        /* Real Google button rendered by GIS */
        <div ref={buttonRef} className="flex justify-center" />
      ) : (
        /* Mock Demo button */
        <button
          type="button"
          onClick={handleMockLogin}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-700 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span className="text-sm">Demo Google Sign-in</span>
        </button>
      )}
    </>
  );
}
