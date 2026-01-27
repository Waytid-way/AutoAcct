// backend/src/types/express.d.ts

/**
 * EXPRESS TYPE AUGMENTATION
 * 
 * Extends Express Request interface to include AutoAcct-specific properties.
 * This prevents TypeScript errors when accessing req.correlationId and req.user.
 * 
 * Reference: Skill 1 - REST Controller Pattern
 */

declare global {
    namespace Express {
        interface Request {
            /**
             * Correlation ID for request tracing
             * Injected by correlationIdMiddleware
             */
            correlationId: string;

            /**
             * Authenticated user information
             * Injected by authMiddleware
             */
            user?: {
                id: string;
                clientId: string;
                role: 'user' | 'accountant' | 'admin';
                email?: string;
            };
        }
    }
}

export { };
