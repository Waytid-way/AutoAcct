import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button Component', () => {
    it('renders correctly with default props', () => {
        render(<Button>Click me</Button>);
        const button = screen.getByRole('button', { name: /click me/i });
        expect(button).toBeInTheDocument();
        // Checking default primary variant class
        expect(button).toHaveClass('bg-accent-primary');
    });

    it('renders with different variants', () => {
        render(<Button variant="danger">Delete</Button>);
        const button = screen.getByRole('button', { name: /delete/i });
        expect(button).toHaveClass('bg-error');
    });

    it('handles click events', () => {
        const handleClick = vi.fn();
        render(<Button onClick={handleClick}>Click me</Button>);
        const button = screen.getByRole('button', { name: /click me/i });
        fireEvent.click(button);
        expect(handleClick).toHaveBeenCalledTimes(1);
    });
});
