// frontend/src/lib/auth.ts

/**
 * Mock Auth Service
 * Simulates authentication for development purposes
 */

const MOCK_TOKEN_KEY = "mock_auth_token";
const MOCK_USER_KEY = "mock_auth_user";

export interface User {
    id: string;
    email: string;
    name: string;
    role: "admin" | "user";
}

export const MOCK_USER: User = {
    id: "user_123",
    email: "demo@autoacct.com",
    name: "Demo User",
    role: "admin",
};

export const authService = {
    /**
     * "Login" a user (sets mock token)
     */
    login: (): void => {
        localStorage.setItem(MOCK_TOKEN_KEY, "mock-jwt-token-xyz-123");
        localStorage.setItem(MOCK_USER_KEY, JSON.stringify(MOCK_USER));
    },

    /**
     * "Logout" a user
     */
    logout: (): void => {
        localStorage.removeItem(MOCK_TOKEN_KEY);
        localStorage.removeItem(MOCK_USER_KEY);
    },

    /**
     * Get current auth token
     */
    getToken: (): string | null => {
        if (typeof window === "undefined") return null;
        return localStorage.getItem(MOCK_TOKEN_KEY);
    },

    /**
     * Get current user
     */
    getUser: (): User | null => {
        if (typeof window === "undefined") return null;
        const data = localStorage.getItem(MOCK_USER_KEY);
        return data ? JSON.parse(data) : null;
    },

    /**
     * Check if authenticated
     */
    isAuthenticated: (): boolean => {
        return !!authService.getToken();
    },

    /**
     * Initialize auth (call on app start)
     */
    init: (): void => {
        // Auto-login for dev convenience if not set
        if (typeof window !== "undefined" && !localStorage.getItem(MOCK_TOKEN_KEY)) {
            console.log("[Auth] Auto-logging in mock user for development");
            authService.login();
        }
    }
};
