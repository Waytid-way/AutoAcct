'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the entire app
 * 
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * 
 * Or with custom fallback:
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error details
        console.error('ErrorBoundary caught an error:', error);
        console.error('Component stack:', errorInfo.componentStack);

        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);

        // Error tracking service integration point
        // To enable error tracking, set NEXT_PUBLIC_SENTRY_DSN in environment
        // and uncomment the Sentry integration below:
        //
        // import * as Sentry from '@sentry/nextjs';
        // Sentry.captureException(error, { extra: errorInfo });
        //
        // Or use LogRocket:
        // import LogRocket from 'logrocket';
        // LogRocket.captureException(error, { extra: errorInfo });
    }

    private handleRetry = () => {
        // Reset error state to retry rendering
        this.setState({ hasError: false, error: null });
    };

    private handleReload = () => {
        // Reload the page as last resort
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
                    <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-lg p-6 text-center">
                        <div className="mb-4">
                            <svg
                                className="mx-auto h-12 w-12 text-red-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>
                        
                        <h2 className="text-xl font-bold text-white mb-2">
                            Something went wrong
                        </h2>
                        
                        <p className="text-gray-400 mb-4">
                            We&apos;re sorry, but something unexpected happened. 
                            Please try again or contact support if the problem persists.
                        </p>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="mb-4 text-left">
                                <details className="bg-gray-900 rounded p-3">
                                    <summary className="text-red-400 cursor-pointer font-mono text-sm">
                                        Error Details (Development Only)
                                    </summary>
                                    <pre className="mt-2 text-xs text-red-300 overflow-auto">
                                        {this.state.error.message}
                                        {'\n'}
                                        {this.state.error.stack}
                                    </pre>
                                </details>
                            </div>
                        )}

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleRetry}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                                Try Again
                            </button>
                            
                            <button
                                onClick={this.handleReload}
                                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                            >
                                Reload Page
                            </button>
                        </div>

                        <p className="mt-4 text-xs text-gray-500">
                            If this error persists, please contact support
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Simple Error Fallback Component
 * For use with ErrorBoundary when you want a simpler UI
 */
export function SimpleErrorFallback({ 
    message = 'An error occurred' 
}: { 
    message?: string 
}) {
    return (
        <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
            <p className="text-red-400">{message}</p>
        </div>
    );
}

export default ErrorBoundary;
