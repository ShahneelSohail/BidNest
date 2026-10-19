'use client';

import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ApiError, api } from '../lib/api';
import { closeSocket } from '../lib/socket';
import type { User } from '../lib/types';

type ToastKind = 'success' | 'error';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const TOAST_MS = 4000;
const ToastContext = createContext<(kind: ToastKind, message: string) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);

interface Credentials {
  email: string;
  password: string;
}
interface Registration extends Credentials {
  username: string;
  fullName: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (credentials: Credentials) => Promise<User>;
  register: (registration: Registration) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
export const useAuth = (): AuthState => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within Providers');
  return context;
};

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { data: user = null, isPending } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<User>('/auth/me').catch(error => (error instanceof ApiError && error.status === 401 ? null : Promise.reject(error))),
    staleTime: Infinity,
  });

  const signIn = useMutation({
    mutationFn: ({ path, body }: { path: string; body: object }) => api.post<User>(path, body),
    onSuccess: signedIn => {
      closeSocket();
      queryClient.clear();
      queryClient.setQueryData(['me'], signedIn);
    },
  });
  const signOut = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      closeSocket();
      queryClient.clear();
      queryClient.setQueryData(['me'], null);
    },
  });

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading: isPending,
      login: credentials => signIn.mutateAsync({ path: '/auth/login', body: credentials }),
      register: registration => signIn.mutateAsync({ path: '/auth/register', body: registration }),
      logout: async () => {
        await signOut.mutateAsync();
      },
    }),
    [user, isPending, signIn, signOut]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts(current => [...current, { id, kind, message }]);
    setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), TOAST_MS);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2" role="status" aria-live="polite">
        {toasts.map(toast => (
          <div key={toast.id} className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg ${toast.kind === 'success' ? 'border-emerald-400/30 bg-emerald-950 text-emerald-100' : 'border-red-400/30 bg-red-950 text-red-100'}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: false, refetchOnWindowFocus: false } } }));
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};
