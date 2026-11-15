
import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  disabled,
  ...props 
}) => {
  // Styles updated for extreme high-contrast visibility and extrabold text
  const baseStyles = "px-6 py-4 rounded-full font-black text-lg tracking-tight transition-all duration-200 active:scale-[0.95] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg";
  
  const variants = {
    // High contrast: Dark Gray text on bright Canary Yellow
    primary: "bg-[#FFC90E] text-gray-900 hover:bg-orange-600 border-none shadow-yellow-400/30",
    // High contrast: Bright White text on Dark Gray
    secondary: "bg-gray-900 text-white hover:bg-gray-800 border-none shadow-gray-900/30",
    // High contrast: Bright White on Intense Red
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-red-500/30",
    // Clean Ghost
    ghost: "bg-transparent text-gray-900 hover:bg-gray-100 shadow-none",
    // Strong Outline
    outline: "bg-transparent border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white shadow-none"
  };

  return (
    <button 
      className={cn(baseStyles, variants[variant], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-6 w-6 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <span className="flex items-center justify-center gap-2">
          {children}
        </span>
      )}
    </button>
  );
};
