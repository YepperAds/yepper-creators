'use client';
import * as React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'icon';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const buttonVariants: Record<string, string> = {
  default: 'bg-white text-background hover:bg-surface-3 border border-border',
  outline: 'border border-border bg-transparent text-subtle hover:bg-surface-2 hover:text-white',
  ghost:   'bg-transparent text-subtle hover:bg-surface-2 hover:text-white',
  icon:    'h-10 w-10 p-0',
};

const buttonSizes: Record<string, string> = {
  default: 'h-10 px-4 py-2',
  sm:      'h-9 rounded-lg px-3',
  lg:      'h-11 rounded-xl px-8',
  icon:    'h-10 w-10',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', ...props }, ref) => (
    <button
      className={`inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = 'Button';

export { Button };
