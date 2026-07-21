import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api, type User } from "../lib/api";
import { getSyncClient } from "../lib/sync-client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, display_name?: string) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((data) => {
        setUser(data.user);
        if (data.user) {
          // Register device & connect sync
          registerCurrentDevice().catch(() => {});
          getSyncClient().connect();
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.login(email, password);
    setUser(data.user);
    // Register device on login
    registerCurrentDevice().catch(() => {});
    getSyncClient().connect();
  }, []);

  const registerFn = useCallback(
    async (email: string, password: string, display_name?: string) => {
      const data = await api.register(email, password, display_name);
      setUser(data.user);
      registerCurrentDevice().catch(() => {});
      getSyncClient().connect();
    },
    []
  );

  const logout = useCallback(async () => {
    getSyncClient().disconnect();
    await api.logout();
    setUser(null);
  }, []);

  const googleLoginFn = useCallback(async (credential: string) => {
    const data = await api.googleLogin(credential);
    setUser(data.user);
    registerCurrentDevice().catch(() => {});
    getSyncClient().connect();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register: registerFn, googleLogin: googleLoginFn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

async function registerCurrentDevice() {
  try {
    await api.registerDevice();
  } catch {
    // Silently fail — device registration is best-effort
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
