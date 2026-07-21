import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          state: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<{
          authorization: {
            id_token: string;
            code: string;
          };
          user?: {
            name?: { firstName?: string; lastName?: string };
            email?: string;
          };
        }>;
      };
    };
  }
}

const AppleLogo = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

export default function AppleSignInButton() {
  const { appleLogin } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  const appleClientId = (import.meta as any).env?.VITE_APPLE_CLIENT_ID || "";

  const handleAppleResponse = useCallback(
    async (identityToken: string, user?: string, fullName?: string, email?: string) => {
      setError("");
      setLoading(true);
      try {
        await appleLogin(identityToken, user, fullName, email);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Apple sign-in failed");
      } finally {
        setLoading(false);
      }
    },
    [appleLogin]
  );

  // Real Apple Sign-In flow
  useEffect(() => {
    if (!appleClientId || scriptLoaded.current) return;

    const script = document.createElement("script");
    script.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoaded.current = true;
      if (window.AppleID && buttonRef.current) {
        window.AppleID.auth.init({
          clientId: appleClientId,
          scope: "name email",
          redirectURI: window.location.origin + "/login",
          state: "apple-signin",
          usePopup: true,
        });

        // Create the Apple button
        const btn = document.createElement("div");
        btn.id = "appleid-signin";
        btn.setAttribute("data-color", "black");
        btn.setAttribute("data-border", "true");
        btn.setAttribute("data-type", "sign in");
        btn.style.width = "100%";
        btn.style.height = "44px";
        buttonRef.current.appendChild(btn);

        // Listen for Apple sign-in completion
        document.addEventListener("AppleIDSignInOnSuccess", ((event: CustomEvent) => {
          const { authorization, user: appleUser } = event.detail || {};
          if (authorization?.id_token) {
            const fullName = appleUser?.name
              ? [appleUser.name.firstName, appleUser.name.lastName].filter(Boolean).join(" ")
              : undefined;
            handleAppleResponse(authorization.id_token, undefined, fullName, appleUser?.email);
          }
        }) as EventListener);

        document.addEventListener("AppleIDSignInOnFailure", ((event: CustomEvent) => {
          setError(event.detail?.error || "Apple sign-in failed");
        }) as EventListener);
      }
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [appleClientId, handleAppleResponse]);

  // Mock mode
  const handleMockLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await appleLogin("mock-apple-demo@catalog.app|Apple DJ|mock-apple-sub-001", undefined, "Apple DJ", "apple-demo@catalog.app");
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
      {/* Divider between Google and Apple */}
      <div className="relative my-4">
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

      {appleClientId ? (
        <div ref={buttonRef} className="flex justify-center mt-4" />
      ) : (
        <button
          type="button"
          onClick={handleMockLogin}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-700 bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-900 transition-colors mt-4"
        >
          <AppleLogo />
          <span className="text-sm">Demo Sign in with Apple</span>
        </button>
      )}
    </>
  );
}
