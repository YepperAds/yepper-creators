'use client';
// @ts-nocheck

import React, { ReactNode } from 'react';
import { Loader2, LucideIcon } from 'lucide-react';
import Loading from './LoadingSpinner';

interface ButtonProps {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon | null;
  iconPosition?: 'left' | 'right';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  [key: string]: unknown;
}

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  icon = null,
  iconPosition = 'right',
  ...props
}: ButtonProps) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants: Record<string, string> = {
    primary:   'bg-white text-background hover:bg-surface-3 border border-border',
    secondary: 'bg-surface-3 text-white hover:bg-surface-2 border border-border',
    outline:   'bg-transparent text-subtle border border-border hover:bg-surface-2 hover:text-white',
    ghost:     'bg-transparent text-subtle hover:bg-surface-2 hover:text-white',
    danger:    'bg-error/10 text-error border border-error/30 hover:bg-error/20',
    success:   'bg-success/10 text-success border border-success/30 hover:bg-success/20',
  };

  const sizes: Record<string, string> = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg',
  };

  const IconComponent = loading ? Loader2 : icon;
  const iconSize = size === 'xs' ? 12 : size === 'sm' ? 14 : size === 'lg' ? 20 : size === 'xl' ? 24 : 16;

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {iconPosition === 'left' && IconComponent && (
        <IconComponent
          size={iconSize}
          className={`${loading ? 'animate-spin' : ''} ${children ? 'mr-2' : ''}`}
        />
      )}
      {children}
      {iconPosition === 'right' && IconComponent && (
        <IconComponent
          size={iconSize}
          className={`${loading ? 'animate-spin' : ''} ${children ? 'ml-2' : ''}`}
        />
      )}
    </button>
  );
};

interface CardProps { children?: ReactNode; className?: string; [key: string]: unknown; }
export const Card = ({ children, className = '', ...props }: CardProps) => (
  <div className={`bg-surface-1 border border-border transition-shadow duration-200 rounded-2xl ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ children, className = '', ...props }: CardProps) => (
  <div className={`px-6 py-4 border-b border-border ${className}`} {...props}>{children}</div>
);

export const CardContent = ({ children, className = '', ...props }: CardProps) => (
  <div className={`px-6 py-4 ${className}`} {...props}>{children}</div>
);

interface HeadingProps { level?: 1|2|3|4|5|6; children?: ReactNode; className?: string; [key: string]: unknown; }
export const Heading = ({ level = 1, children, className = '', ...props }: HeadingProps) => {
  const styles: Record<number, string> = {
    1: 'text-5xl font-bold text-white',
    2: 'text-3xl font-bold text-white',
    3: 'text-xl font-semibold text-white',
    4: 'text-lg font-semibold text-white',
    5: 'text-base font-semibold text-white',
    6: 'text-sm font-semibold text-white',
  };
  return React.createElement(`h${level}`, { className: `${styles[level]} ${className}`, ...props }, children);
};

interface TextProps { variant?: 'body'|'small'|'large'|'muted'|'error'|'success'; children?: ReactNode; className?: string; [key: string]: unknown; }
export const Text = ({ variant = 'body', children, className = '', ...props }: TextProps) => {
  const variants: Record<string, string> = {
    body:    'text-sm text-subtle',
    small:   'text-xs text-muted',
    large:   'text-base text-subtle',
    muted:   'text-sm text-muted',
    error:   'text-sm text-error',
    success: 'text-sm text-success',
  };
  return <p className={`${variants[variant]} ${className}`} {...props}>{children}</p>;
};

interface InputProps {
  label?: string;
  error?: string;
  helperText?: string;
  className?: string;
  required?: boolean;
  [key: string]: unknown;
}
export const Input = ({ label, error, helperText, className = '', required = false, ...props }: InputProps) => (
  <div className="space-y-1.5">
    {label && (
      <label className="block text-sm font-medium text-subtle">
        {label}{required && <span className="text-error ml-1">*</span>}
      </label>
    )}
    <input
      className={`block w-full px-3 py-2 border border-border bg-surface-2 text-white text-sm placeholder-muted rounded-lg focus:outline-none focus:ring-1 focus:ring-white focus:border-white disabled:bg-surface-3 disabled:text-muted transition-colors ${error ? 'border-error focus:ring-error focus:border-error' : ''} ${className}`}
      {...props}
    />
    {error && <Text variant="error">{error}</Text>}
    {helperText && !error && <Text variant="muted">{helperText}</Text>}
  </div>
);

interface TextAreaProps extends InputProps { rows?: number; }
export const TextArea = ({ label, error, helperText, className = '', required = false, rows = 3, ...props }: TextAreaProps) => (
  <div className="space-y-1.5">
    {label && (
      <label className="block text-sm font-medium text-subtle">
        {label}{required && <span className="text-error ml-1">*</span>}
      </label>
    )}
    <textarea
      rows={rows}
      className={`block w-full px-3 py-2 border border-border bg-surface-2 text-white text-sm placeholder-muted rounded-lg focus:outline-none focus:ring-1 focus:ring-white focus:border-white disabled:bg-surface-3 disabled:text-muted resize-vertical transition-colors ${error ? 'border-error focus:ring-error focus:border-error' : ''} ${className}`}
      {...props}
    />
    {error && <Text variant="error">{error}</Text>}
    {helperText && !error && <Text variant="muted">{helperText}</Text>}
  </div>
);

interface SelectProps extends InputProps { children?: ReactNode; }
export const Select = ({ label, error, helperText, className = '', required = false, children, ...props }: SelectProps) => (
  <div className="space-y-1.5">
    {label && (
      <label className="block text-sm font-medium text-subtle">
        {label}{required && <span className="text-error ml-1">*</span>}
      </label>
    )}
    <select
      className={`block w-full px-3 py-2 border border-border bg-surface-2 text-white text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-white focus:border-white disabled:bg-surface-3 disabled:text-muted transition-colors ${error ? 'border-error focus:ring-error focus:border-error' : ''} ${className}`}
      {...props}
    >
      {children}
    </select>
    {error && <Text variant="error">{error}</Text>}
    {helperText && !error && <Text variant="muted">{helperText}</Text>}
  </div>
);

interface BadgeProps { children?: ReactNode; variant?: 'default'|'primary'|'success'|'warning'|'danger'|'info'; className?: string; [key: string]: unknown; }
export const Badge = ({ children, variant = 'default', className = '', ...props }: BadgeProps) => {
  const variants: Record<string, string> = {
    default: 'bg-surface-3 text-white border border-border',
    primary: 'bg-surface-2 text-white border border-border',
    success: 'bg-success/10 text-success border border-success/30',
    warning: 'bg-warning/10 text-warning border border-warning/30',
    danger:  'bg-error/10 text-error border border-error/30',
    info:    'bg-blue/10 text-blue border border-blue/30',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${variants[variant]} ${className}`} {...props}>{children}</span>;
};

interface LoadingSpinnerProps { size?: 'sm'|'md'|'lg'|'xl'; className?: string; }
export const LoadingSpinner = ({ size = 'md', className = '' }: LoadingSpinnerProps) => {
  const sizes: Record<string, string> = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8', xl: 'h-12 w-12' };
  return <Loading className={`animate-spin text-muted ${sizes[size]} ${className}`} />;
};

interface AlertProps { children?: ReactNode; variant?: 'info'|'success'|'warning'|'error'; className?: string; [key: string]: unknown; }
export const Alert = ({ children, variant = 'info', className = '', ...props }: AlertProps) => {
  const variants: Record<string, string> = {
    info:    'bg-blue/10 border-blue/30 text-blue',
    success: 'bg-success/10 border-success/30 text-success',
    warning: 'bg-warning/10 border-warning/30 text-warning',
    error:   'bg-error/10 border-error/30 text-error',
  };
  return <div className={`border rounded-xl px-4 py-3 text-sm ${variants[variant]} ${className}`} {...props}>{children}</div>;
};

interface ContainerProps { children?: ReactNode; size?: 'sm'|'default'|'lg'; className?: string; [key: string]: unknown; }
export const Container = ({ children, size = 'default', className = '', ...props }: ContainerProps) => {
  const sizes: Record<string, string> = { sm: 'max-w-4xl', default: 'max-w-7xl', lg: 'max-w-full' };
  return <div className={`${sizes[size]} mx-auto px-4 sm:px-8 lg:px-8 ${className}`} {...props}>{children}</div>;
};

interface GridProps { children?: ReactNode; cols?: 1|2|3|4|6; gap?: 2|4|6|8; className?: string; [key: string]: unknown; }
export const Grid = ({ children, cols = 1, gap = 4, className = '', ...props }: GridProps) => {
  const gridCols: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  };
  const gaps: Record<number, string> = { 2: 'gap-2', 4: 'gap-4', 6: 'gap-6', 8: 'gap-8' };
  return <div className={`grid ${gridCols[cols]} ${gaps[gap]} ${className}`} {...props}>{children}</div>;
};
