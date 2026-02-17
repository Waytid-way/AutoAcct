// frontend/src/lib/auth.ts

/**
 * Authentication Service
 * Handles JWT token management and user session
 * 
 * SECURITY NOTE: Using httpOnly cookies is more secure than localStorage
 * This implementation uses localStorage for simplicity but should be
 * migrated to httpOnly cookies in production
 */

import apiClient, { setTokenProvider } from './api-client';

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";
const TOKEN_EXPIRY_KEY = "auth_expiry";

export interface User {
    id: string;
    email: string;
    name: string;
    role: "admin" | "user";
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface AuthResponse {
    token: string;
    user: User;
    expiresAt: string;
}

class AuthService {
    private refreshTimer: NodeJS.Timeout | null = null;

    /**
     * Login with credentials
     */
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        // In production, this should call your actual auth API
        // For now, we'll simulate the API call structure
        try {
            const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
            const { token, user, expiresAt } = response.data;
            
            this.setSession(token, user, expiresAt);
            this.scheduleTokenRefresh(expiresAt);
            
            return response.data;
        } catch (error) {
            console.error('[Auth] Login failed:', error);
            throw new Error('Invalid credentials');
        }
    }

    /**
     * Logout user
     */
    logout(): void {
        this.clearSession();
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        // Optionally call logout API to invalidate token on server
        apiClient.post('/auth/logout').catch(() => {});
    }

    /**
     * Get current auth token
     */
    getToken(): string | null {
        if (typeof window === "undefined") return null;
        return localStorage.getItem(TOKEN_KEY);
    }

    /**
     * Get current user
     */
    getUser(): User | null {
        if (typeof window === "undefined") return null;
        const data = localStorage.getItem(USER_KEY);
        if (!data) return null;
        
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        const token = this.getToken();
        const expiry = this.getTokenExpiry();
        
        if (!token) return false;
        if (expiry && new Date(expiry) < new Date()) {
            this.clearSession();
            return false;
        }
        
        return true;
    }

    /**
     * Check if user has specific role
     */
    hasRole(role: User['role']): boolean {
        const user = this.getUser();
        return user?.role === role;
    }

    /**
     * Initialize auth state (call on app start)
     * 
     * SECURITY FIX: Removed auto-login behavior
     * Users must explicitly log in
     */
    init(): void {
        if (typeof window === "undefined") return;
        
        const token = this.getToken();
        const expiry = this.getTokenExpiry();
        
        if (token && expiry) {
            const expiryDate = new Date(expiry);
            
            if (expiryDate < new Date()) {
                // Token expired, clear session
                console.log('[Auth] Token expired, please log in again');
                this.clearSession();
            } else {
                // Token valid, schedule refresh
                this.scheduleTokenRefresh(expiry);
            }
        }
        
        // DEBUG MODE: Only enable mock auth if explicitly set
        if (process.env.NEXT_PUBLIC_MOCK_AUTH === 'true' && !token) {
            console.warn('[Auth] MOCK AUTH ENABLED - This should only be used in development!');
            this.enableMockAuth();
        }
    }

    /**
     * Refresh token before expiry
     */
    async refreshToken(): Promise<void> {
        try {
            const response = await apiClient.post<AuthResponse>('/auth/refresh');
            const { token, user, expiresAt } = response.data;
            this.setSession(token, user, expiresAt);
            this.scheduleTokenRefresh(expiresAt);
        } catch (error) {
            console.error('[Auth] Token refresh failed:', error);
            this.clearSession();
            throw error;
        }
    }

    /**
     * Request password reset
     */
    async requestPasswordReset(email: string): Promise<void> {
        await apiClient.post('/auth/forgot-password', { email });
    }

    /**
     * Reset password with token
     */
    async resetPassword(token: string, newPassword: string): Promise<void> {
        await apiClient.post('/auth/reset-password', { token, newPassword });
    }

    // Private helper methods

    private setSession(token: string, user: User, expiresAt: string): void {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt);
    }

    private clearSession(): void {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
    }

    private getTokenExpiry(): string | null {
        if (typeof window === "undefined") return null;
        return localStorage.getItem(TOKEN_EXPIRY_KEY);
    }

    private scheduleTokenRefresh(expiresAt: string): void {
        const expiryDate = new Date(expiresAt);
        const now = new Date();
        const timeUntilExpiry = expiryDate.getTime() - now.getTime();
        
        // Refresh 5 minutes before expiry
        const refreshTime = Math.max(timeUntilExpiry - 5 * 60 * 1000, 0);
        
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        
        this.refreshTimer = setTimeout(() => {
            this.refreshToken().catch(() => {
                // Refresh failed, user will need to re-login
                this.clearSession();
            });
        }, refreshTime);
    }

    /**
     * Enable mock authentication for development
     * ONLY use this in development!
     */
    private enableMockAuth(): void {
        const mockUser: User = {
            id: "user_123",
            email: "demo@autoacct.com",
            name: "Demo User",
            role: "admin",
        };
        
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 24);
        
        this.setSession('mock-jwt-token-dev-only', mockUser, expiry.toISOString());
    }
}

// Create singleton instance
export const authService = new AuthService();

// Register token provider to break circular dependency
// This allows api-client to get tokens without importing auth.ts
setTokenProvider(() => authService.getToken());

// Mock user for development (when MOCK_AUTH is enabled)
export const MOCK_USER: User = {
    id: "user_123",
    email: "demo@autoacct.com",
    name: "Demo User",
    role: "admin",
};

// Types are already exported as interfaces above
