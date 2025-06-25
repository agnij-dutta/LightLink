'use client';

// Simple toast implementation
interface ToastProps {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export const toast = ({ title, description, variant = 'default' }: ToastProps) => {
  // For now, we'll use console.log as a placeholder
  // In a real app, you'd implement a proper toast system
  console.log(`Toast [${variant}]: ${title}${description ? ` - ${description}` : ''}`);
  
  // You could also use browser notifications or a toast library here
  if (typeof window !== 'undefined') {
    // Simple alert as fallback
    alert(`${title}${description ? `\n${description}` : ''}`);
  }
}; 