import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Convert Satang to Baht for display
 * @param satang - Amount in Satang (integer)
 * @returns Formatted string like "฿125.00"
 */
export function formatCurrency(satang: number): string {
    const baht = satang / 100;
    return `฿${baht.toFixed(2)}`;
}

/**
 * Convert Baht to Satang for API submission
 * @param baht - Amount in Baht (with decimals)
 * @returns Integer Satang
 * @throws Error if more than 2 decimal places
 */
export function bahtToSatang(baht: number): number {
    const satang = Math.round(baht * 100);

    // Check for more than 2 decimal places
    if (Math.abs(baht * 100 - satang) > 0.01) {
        throw new Error('Amount has more than 2 decimal places');
    }

    return satang;
}

/**
 * Format file size to human-readable string
 * @param bytes - File size in bytes
 * @returns Formatted string like "2.5 MB"
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Format date to human-readable string
 * @param date - ISO 8601 date string or Date object
 * @returns Formatted string like "Jan 27, 2026"
 */
export function formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}
