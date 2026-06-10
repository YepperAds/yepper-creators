'use client';
import React from 'react';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: 'default' | 'destructive';
  children?: React.ReactNode;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', children, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      {...props}
      className={`relative w-full rounded-xl border p-4
        ${variant === 'default'     ? 'bg-surface-2 text-subtle border-border' : ''}
        ${variant === 'destructive' ? 'bg-error/10 text-error border-error/30' : ''}
        ${className ?? ''}
      `}
    >
      <div className="flex gap-2">{children}</div>
    </div>
  )
);

interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> { className?: string; }
const AlertTitle = React.forwardRef<HTMLHeadingElement, AlertTitleProps>(({ className, ...props }, ref) => (
  <h5 ref={ref} {...props} className={`font-medium leading-none tracking-tight ${className ?? ''}`} />
));

interface AlertDescriptionProps extends React.HTMLAttributes<HTMLDivElement> { className?: string; }
const AlertDescription = React.forwardRef<HTMLDivElement, AlertDescriptionProps>(({ className, ...props }, ref) => (
  <div ref={ref} {...props} className={`text-sm [&_p]:leading-relaxed ${className ?? ''}`} />
));

Alert.displayName = 'Alert';
AlertTitle.displayName = 'AlertTitle';
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
