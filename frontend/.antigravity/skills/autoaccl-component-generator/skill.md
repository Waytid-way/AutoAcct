# AutoAcct Component Generator

## Identity
**Name:** AutoAcct Component Generator  
**Version:** 1.0.0  
**Author:** AutoAcct Team  
**Purpose:** Generate production-ready React components that automatically comply with Muji Dark minimalist design system

## When to Use This Skill

Activate this skill AUTOMATICALLY when the user:
- Says "create a component"
- Says "build a [component name]"
- Asks for UI elements (button, card, modal, form, alert, badge, etc.)
- Mentions "design system" or "dark theme"
- Requests refactoring existing components

## Design System (STRICT COMPLIANCE REQUIRED)

### Color Palette
**ONLY use these colors. NO exceptions. NO hardcoded hex values.**

```json
{
  "background": {
    "app": "#0A0A0A",
    "surface": "#141414",
    "subtle": "#1A1A1A"
  },
  "border": {
    "default": "#262626",
    "strong": "#333333",
    "subtle": "#1F1F1F"
  },
  "text": {
    "primary": "#ECECEC",
    "secondary": "#A3A3A3",
    "tertiary": "#737373"
  },
  "accent": {
    "primary": "#3B82F6",
    "hover": "#2563EB"
  },
  "status": {
    "success": "#10B981",
    "warning": "#F59E0B",
    "error": "#EF4444",
    "info": "#3B82F6"
  }
}
```

**Tailwind Mapping:**
- `bg-background-app` → #0A0A0A
- `bg-surface` → #141414
- `border-border-default` → #262626
- `text-text-primary` → #ECECEC
- `text-text-secondary` → #A3A3A3
- `bg-accent` → #3B82F6
- `bg-status-success` → #10B981
- `bg-status-warning` → #F59E0B
- `bg-status-error` → #EF4444

### Typography
- **Font Family**: Inter (sans-serif), JetBrains Mono (monospace for currency)
- **Sizes**: text-xs (12px), text-sm (14px), text-base (16px), text-lg (18px), text-xl (24px)
- **Weights**: font-normal (400), font-medium (500), font-semibold (600), font-bold (700)

### Spacing (8px Grid System)
- **Gaps**: gap-2 (8px), gap-4 (16px), gap-6 (24px), gap-8 (32px)
- **Padding**: p-3 (12px), p-4 (16px), p-6 (24px), p-8 (32px)
- **Margins**: Same as padding

### Border Radius
- **Small**: rounded-lg (8px) - for buttons, badges
- **Medium**: rounded-xl (12px) - for cards, inputs
- **Large**: rounded-2xl (16px) - for modals

### Transitions
- **Fast**: `transition-colors duration-150` - for hover states
- **Base**: `transition-all duration-300` - for transforms
- **Easing**: `ease-in-out` or `cubic-bezier(0.4, 0, 0.2, 1)`

## Component Checklist

Before generating ANY component, verify:

### 1. Color Compliance ✅
- [ ] All colors from design-system.json ONLY
- [ ] No hardcoded hex values (e.g., `#FF0000`)
- [ ] Use Tailwind design tokens (e.g., `bg-accent`, not `bg-blue-500`)
- [ ] Run `validate-colors.js` after generation

### 2. TypeScript Strict ✅
- [ ] Proper interface for props
- [ ] No `any` types (use `unknown` if truly needed)
- [ ] Export all types
- [ ] JSDoc comments for all props

### 3. Accessibility ✅
- [ ] ARIA labels for icons/icon-only buttons
- [ ] Focus states visible: `focus:outline-none focus:ring-2 focus:ring-accent`
- [ ] Keyboard navigation support
- [ ] Screen reader text: `<span className="sr-only">...</span>`

### 4. Responsive ✅
- [ ] Mobile-first approach
- [ ] Touch targets ≥44px on mobile
- [ ] Test at 375px (mobile), 768px (tablet), 1024px (desktop)

### 5. Performance ✅
- [ ] Use `React.memo()` if component is pure
- [ ] Lazy load heavy components with `React.lazy()`
- [ ] Avoid inline functions in JSX (use `useCallback`)

## Component Generation Workflow

### Step 1: Analyze Request
```
User: "Create an alert component for anomalies"

Analysis:
- Component type: Alert/Notification
- Context: Anomaly detection system
- Required variants: info, warning, critical
- Required props: severity, title, message, onDismiss
```

### Step 2: Select Base Template
- Choose from: Button, Card, Modal, Alert, Badge, Form Field
- If no template fits → create from scratch using design system

### Step 3: Generate Component
```typescript
// Template structure:
// 1. Imports (React, icons, utils)
// 2. TypeScript interface
// 3. Component function with JSDoc
// 4. Conditional styling (CVA or cn())
// 5. Return JSX with proper structure
// 6. Export
```

### Step 4: Validate
- Run `validate-colors.js [filename].tsx`
- Check TypeScript errors: `tsc --noEmit`
- Verify accessibility: manual check

### Step 5: Generate Tests (Optional)
- Create `[ComponentName].test.tsx`
- Cover all variants and states
- Test accessibility

## Code Patterns

### Pattern 1: Button Variants (CVA)
```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base styles (always applied)
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accent-hover',
        secondary: 'bg-surface border border-border-default text-text-primary hover:bg-surface-subtle',
        ghost: 'text-text-primary hover:bg-surface-subtle',
        danger: 'bg-status-error text-white hover:opacity-90',
      },
      size: {
        sm: 'px-3 py-2 text-sm',
        md: 'px-4 py-3 text-base',
        lg: 'px-6 py-4 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Content to display inside button */
  children: React.ReactNode;
  /** Loading state - shows spinner */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Spinner className="mr-2" size="sm" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

### Pattern 2: Conditional Styling (cn utility)
```typescript
<div
  className={cn(
    'rounded-xl p-4 border',
    {
      'border-status-success bg-status-success/10': severity === 'info',
      'border-status-warning bg-status-warning/10': severity === 'warning',
      'border-status-error bg-status-error/10': severity === 'critical',
    }
  )}
>
```

### Pattern 3: Icon Sizing
```typescript
// Small: w-4 h-4 (16px)
// Medium: w-5 h-5 (20px)
// Large: w-6 h-6 (24px)

<AlertTriangle className="w-5 h-5 text-status-warning" />
```

### Pattern 4: Currency Display
```typescript
import { formatCurrency } from '@/lib/utils';

// Always use formatCurrency for money
<span className="font-mono font-semibold text-text-primary">
  {formatCurrency(amount)} {/* amount in Satang */}
</span>
```

## Anti-Patterns (NEVER DO)

❌ **Hardcoded Colors**
```typescript
// ❌ WRONG
<div className="bg-[#FF0000]">...</div>
<div style={{ backgroundColor: '#FF0000' }}>...</div>

// ✅ CORRECT
<div className="bg-status-error">...</div>
```

❌ **Arbitrary Spacing**
```typescript
// ❌ WRONG (13px not in 8px grid)
<div className="p-[13px]">...</div>

// ✅ CORRECT (16px = 2 × 8px)
<div className="p-4">...</div>
```

❌ **Missing Types**
```typescript
// ❌ WRONG
export const Button = ({ text, click }) => { ... }

// ✅ CORRECT
interface ButtonProps {
  text: string;
  onClick: () => void;
}
export const Button: React.FC<ButtonProps> = ({ text, onClick }) => { ... }
```

❌ **No Accessibility**
```typescript
// ❌ WRONG
<button onClick={handleClick}>
  <X />
</button>

// ✅ CORRECT
<button onClick={handleClick} aria-label="Close">
  <X />
  <span className="sr-only">Close</span>
</button>
```

❌ **Inline Styles**
```typescript
// ❌ WRONG
<div style={{ padding: '16px', color: '#ECECEC' }}>...</div>

// ✅ CORRECT
<div className="p-4 text-text-primary">...</div>
```

## Success Criteria

Component is PRODUCTION-READY when:

✅ **Zero color violations** (validated by script)  
✅ **TypeScript compiles** with no errors (`tsc --noEmit`)  
✅ **All props documented** (JSDoc comments)  
✅ **Accessibility score 100%** (manual check)  
✅ **Mobile responsive** (tested 375px, 768px, 1024px)  
✅ **Follows 8px spacing grid**  
✅ **Focus states visible**  
✅ **Loading/disabled states handled**

## Integration with AutoAcct Codebase

- **Location**: `src/components/[Category]/[ComponentName].tsx`
- **Import utils**: `import { cn } from '@/lib/utils'`
- **Import currency**: `import { formatCurrency } from '@/lib/utils'`
- **Export pattern**: Named export + re-export from `index.ts`

Example:
```typescript
// src/components/Anomaly/AnomalyAlert.tsx
export const AnomalyAlert = ...

// src/components/Anomaly/index.ts
export { AnomalyAlert } from './AnomalyAlert';
export { AnomalyDashboard } from './AnomalyDashboard';
```

## Feedback Loop

After generating a component:

1. **Show preview** (if visual)
2. **Run validation script** automatically
3. **Report violations** (if any)
4. **Suggest fixes** for common issues
5. **Ask for confirmation** before writing files

Example output:
```
✅ Component generated: AnomalyAlert.tsx
✅ Color validation: PASSED (0 violations)
✅ TypeScript check: PASSED
⚠️  Accessibility: Focus state missing on dismiss button
   Fix: Add focus:ring-2 focus:ring-accent

Would you like me to:
1. Apply the fix automatically
2. Generate tests for this component
3. Create a Storybook story
```

## Examples

### Example 1: Alert Component
```typescript
// ✅ GOOD: Follows all rules
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Severity = 'info' | 'warning' | 'critical';

interface AnomalyAlertProps {
  /** Severity level of the anomaly */
  severity: Severity;
  /** Alert title */
  title: string;
  /** Detailed message */
  message: string;
  /** Optional action text */
  action?: string;
  /** Dismiss handler */
  onDismiss?: () => void;
  /** Action handler */
  onAction?: () => void;
}

/**
 * Alert component for displaying anomaly detection results
 * 
 * @example
 * ```tsx
 * <AnomalyAlert
 *   severity="warning"
 *   title="Price Outlier Detected"
 *   message="Receipt amount is 200% above average"
 *   action="Review"
 *   onAction={() => console.log('Review clicked')}
 *   onDismiss={() => console.log('Dismissed')}
 * />
 * ```
 */
export const AnomalyAlert: React.FC<AnomalyAlertProps> = ({
  severity,
  title,
  message,
  action,
  onDismiss,
  onAction,
}) => {
  return (
    <div
      className={cn(
        'rounded-xl p-4 border-2 flex items-start gap-3',
        'transition-all duration-150',
        {
          'border-status-info bg-status-info/10': severity === 'info',
          'border-status-warning bg-status-warning/10': severity === 'warning',
          'border-status-error bg-status-error/10': severity === 'critical',
        }
      )}
      role="alert"
    >
      {/* Icon */}
      <AlertTriangle
        className={cn('w-5 h-5 mt-0.5 flex-shrink-0', {
          'text-status-info': severity === 'info',
          'text-status-warning': severity === 'warning',
          'text-status-error': severity === 'critical',
        })}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-text-primary mb-1">{title}</h4>
        <p className="text-sm text-text-secondary">{message}</p>
        
        {/* Action Button */}
        {action && onAction && (
          <button
            onClick={onAction}
            className="mt-2 text-sm font-medium text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-accent rounded"
          >
            {action} →
          </button>
        )}
      </div>

      {/* Dismiss Button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-text-tertiary hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-accent rounded"
          aria-label="Dismiss alert"
        >
          <X className="w-5 h-5" />
          <span className="sr-only">Dismiss</span>
        </button>
      )}
    </div>
  );
};
```

### Example 2: Badge Component
```typescript
// ✅ GOOD: Simple, compliant, accessible
import React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'info' | 'success' | 'warning' | 'error' | 'default';

interface BadgeProps {
  /** Visual variant */
  variant?: BadgeVariant;
  /** Badge content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  children,
  className,
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        {
          'bg-surface border border-border-default text-text-secondary': variant === 'default',
          'bg-status-info/20 text-status-info': variant === 'info',
          'bg-status-success/20 text-status-success': variant === 'success',
          'bg-status-warning/20 text-status-warning': variant === 'warning',
          'bg-status-error/20 text-status-error': variant === 'error',
        },
        className
      )}
    >
      {children}
    </span>
  );
};
```

## Notes

- This skill should be INVISIBLE to the user
- Automatically validate and fix common issues
- Always explain violations clearly
- Offer to auto-fix when possible
- Maintain AutoAcct's minimalist aesthetic at all costs
