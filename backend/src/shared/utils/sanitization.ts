/**
 * Sanitization Utilities
 * 
 * Provides functions to sanitize user inputs and prevent:
 * - XSS attacks
 * - NoSQL injection
 * - Path traversal
 * - Command injection
 */

import xss from 'xss';

/**
 * Sanitize a filename to prevent path traversal and malicious characters
 */
export function sanitizeFileName(fileName: string): string {
    // Remove path traversal attempts
    let sanitized = fileName
        .replace(/\.\./g, '') // Remove path traversal
        .replace(/[\\/]/g, '_') // Replace path separators
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars
        .replace(/_{2,}/g, '_'); // Collapse multiple underscores
    
    // Ensure filename isn't empty
    if (!sanitized || sanitized === '_') {
        sanitized = 'unnamed_file';
    }
    
    // Limit length
    if (sanitized.length > 255) {
        const ext = sanitized.lastIndexOf('.') > 0 
            ? sanitized.slice(sanitized.lastIndexOf('.')) 
            : '';
        sanitized = sanitized.slice(0, 250) + ext;
    }
    
    return sanitized;
}

/**
 * Sanitize text content to prevent XSS
 */
export function sanitizeText(text: string): string {
    if (!text) return '';
    
    // Use xss library for comprehensive XSS protection
    return xss(text, {
        whiteList: {}, // No HTML tags allowed
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script'],
    });
}

/**
 * Sanitize HTML content (if HTML is allowed)
 * Allows only safe HTML tags
 */
export function sanitizeHtml(html: string): string {
    if (!html) return '';
    
    return xss(html, {
        whiteList: {
            b: [],
            i: [],
            em: [],
            strong: [],
            u: [],
            br: [],
            p: [],
        },
        stripIgnoreTag: true,
    });
}

/**
 * Validate and sanitize email address
 */
export function sanitizeEmail(email: string): string {
    if (!email) return '';
    
    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmed = email.trim().toLowerCase();
    
    if (!emailRegex.test(trimmed)) {
        throw new Error('Invalid email format');
    }
    
    return trimmed;
}

/**
 * Sanitize a string for use in MongoDB queries
 * Prevents NoSQL injection
 */
export function sanitizeForMongo(input: string): string {
    if (!input) return '';
    
    // Remove MongoDB operators
    return input
        .replace(/\$/g, '')
        .replace(/\{.*\}/g, '');
}

/**
 * Sanitize object keys and values recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
        // Sanitize key
        const sanitizedKey = sanitizeForMongo(key);
        
        // Sanitize value based on type
        if (typeof value === 'string') {
            sanitized[sanitizedKey] = sanitizeText(value);
        } else if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                sanitized[sanitizedKey] = value.map(item => 
                    typeof item === 'string' ? sanitizeText(item) : item
                );
            } else {
                sanitized[sanitizedKey] = sanitizeObject(value);
            }
        } else {
            sanitized[sanitizedKey] = value;
        }
    }
    
    return sanitized;
}

/**
 * Validate file type against allowed types
 */
export function validateFileType(
    mimeType: string, 
    allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
): boolean {
    return allowedTypes.includes(mimeType);
}

/**
 * Validate file size (in bytes)
 */
export function validateFileSize(
    sizeBytes: number, 
    maxSizeMB: number = 10
): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return sizeBytes <= maxSizeBytes;
}

/**
 * Escape special regex characters
 */
export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a safe regex pattern from user input
 */
export function createSafeRegex(pattern: string, flags?: string): RegExp {
    const escaped = escapeRegex(pattern);
    return new RegExp(escaped, flags);
}
