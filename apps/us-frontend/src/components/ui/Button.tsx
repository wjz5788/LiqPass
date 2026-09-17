import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline" | "danger";
  // 修复：Links.tsx / WalletSettings.tsx 一直在传 size，但类型里没有声明
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit" | "reset";
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  size = "md",
  type = "button",
  className = ""
}) => {
  const baseClasses = "inline-flex items-center justify-center rounded-lg font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed";
  
  const variantClasses = {
    primary: "bg-amber-600 text-white hover:bg-amber-500",
    danger: "bg-red-600 text-white hover:bg-red-500", 
    outline: "border border-stone-300 bg-white text-stone-900 hover:bg-stone-50"
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-3 text-base"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
};
