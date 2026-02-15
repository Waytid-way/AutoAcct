'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authService } from '@/lib/auth';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: 'admin' | 'user';
}

/**
 * Protected Route Component
 * Wraps pages that require authentication
 * 
 * Usage:
 * <ProtectedRoute>
 *   <YourPage />
 * </ProtectedRoute>
 * 
 * Or with role requirement:
 * <ProtectedRoute requiredRole="admin">
 *   <AdminPage />
 * </ProtectedRoute>
 */
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        // Initialize auth
        authService.init();

        // Check authentication
        const isAuthenticated = authService.isAuthenticated();
        
        if (!isAuthenticated) {
            // Redirect to login with return URL
            const returnUrl = encodeURIComponent(pathname);
            router.push(`/login?returnUrl=${returnUrl}`);
            return;
        }

        // Check role if required
        if (requiredRole && !authService.hasRole(requiredRole)) {
            // User doesn't have required role
            setIsAuthorized(false);
            setIsLoading(false);
            return;
        }

        setIsAuthorized(true);
        setIsLoading(false);
    }, [router, pathname, requiredRole]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-4 text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
                    <p className="text-gray-400">
                        You don&apos;t have permission to access this page.
                    </p>
                    <button
                        onClick={() => router.push('/')}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

/**
 * Hook to check authentication status
 */
export function useAuth() {
    const [user, setUser] = useState(authService.getUser());
    const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());

    useEffect(() => {
        // Update state when auth changes
        const checkAuth = () => {
            setUser(authService.getUser());
            setIsAuthenticated(authService.isAuthenticated());
        };

        checkAuth();

        // Listen for storage changes (logout from other tabs)
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'auth_token') {
                checkAuth();
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    return {
        user,
        isAuthenticated,
        login: authService.login.bind(authService),
        logout: authService.logout.bind(authService),
    };
}
