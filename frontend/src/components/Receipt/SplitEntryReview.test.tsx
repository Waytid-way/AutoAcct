import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SplitEntryReview } from './SplitEntryReview';

// Mock UI components
vi.mock('@/components/ui/Button', () => ({
    Button: ({ children, onClick, ...props }: any) => (
        <button onClick={onClick} {...props}>
            {children}
        </button>
    ),
}));
vi.mock('@/components/ui/Badge', () => ({
    Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>
}));

describe('SplitEntryReview Form Integration', () => {
    const mockOnConfirm = vi.fn();
    const mockOnCancel = vi.fn();

    // 100 Baht total
    const receiptTotal = 10000;

    it('renders with initial items correctly', () => {
        const initialItems = [
            { description: 'Item 1', quantity: 1, unitPrice: 5000, totalPrice: 5000 },
            { description: 'Item 2', quantity: 1, unitPrice: 5000, totalPrice: 5000 },
        ];

        render(
            <SplitEntryReview
                initialItems={initialItems}
                receiptTotal={receiptTotal}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        expect(screen.getByDisplayValue('Item 1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Item 2')).toBeInTheDocument();
        // Check calculation span (appears twice: Expected Total and Current Total)
        expect(screen.getAllByText('฿100.00')).toHaveLength(2);
    });

    it('validates required fields (Zod Schema)', async () => {
        render(
            <SplitEntryReview
                initialItems={[]}
                receiptTotal={receiptTotal}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        // Click confirm
        const confirmBtn = screen.getByText(/Confirm Split/i);
        fireEvent.click(confirmBtn);

        // Expect validation error for description
        await waitFor(() => {
            const error = screen.queryByText(/Description is required/i);
            expect(error).toBeInTheDocument();
        });

        expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('validates quantity must be greater than 0', async () => {
        render(
            <SplitEntryReview
                initialItems={[{ description: 'Item 1', quantity: 0, unitPrice: 100, totalPrice: 100 }]}
                receiptTotal={receiptTotal}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        const confirmBtn = screen.getByText(/Confirm Split/i);
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            const errorMessages = screen.getAllByText(/Qty must be >= 1/i);
            expect(errorMessages.length).toBeGreaterThan(0);
        });
    });

    it('submits valid data correctly', async () => {
        render(
            <SplitEntryReview
                initialItems={[{ description: 'Valid Item', quantity: 1, unitPrice: 10000, totalPrice: 10000 }]}
                receiptTotal={receiptTotal}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        const confirmBtn = screen.getByText(/Confirm Split/i);
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(mockOnConfirm).toHaveBeenCalledTimes(1);
            expect(mockOnConfirm).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({
                    description: 'Valid Item',
                    totalPrice: 10000
                })
            ]));
        });
    });

    it('calculates totals mismatch warning', () => {
        render(
            <SplitEntryReview
                initialItems={[{ description: 'Item A', quantity: 1, unitPrice: 5000, totalPrice: 5000 }]}
                receiptTotal={10000} // Expected 100, provided 50
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        // Should see mismatch warning text specifically
        expect(screen.getByText('Mismatch of ฿50.00')).toBeInTheDocument();

        // Check current total display. 
        // We can find it by looking for the span with `text-error` since it's mismatched.
        // Or simply check that ฿50.00 appears twice in the document.
        const elements = screen.getAllByText(/฿50.00/);
        expect(elements.length).toBeGreaterThanOrEqual(2);
    });
});
