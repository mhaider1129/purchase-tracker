// src/components/ui/Button.jsx
import React from "react";
import { useTranslation } from "react-i18next";

const Button = ({
  children,
  onClick,
  type = "button",
  variant = "primary",
  className = "",
  disabled = false,
  isLoading = false,
  fullWidth = false,
  ariaLabel,
  ...props
}) => {
  const { t } = useTranslation();
  const baseStyles = "token-button";

  const variantStyles = {
    primary: "token-button-primary focus:ring-blue-500",
    destructive: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
    secondary: "token-button-secondary focus:ring-gray-400",
  };

  const combinedClasses = [
    baseStyles,
    variantStyles[variant],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      onClick={onClick}
      className={combinedClasses}
      disabled={disabled || isLoading}
      aria-label={ariaLabel || undefined}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            ></path>
          </svg>
          {t("common.loading")}
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export { Button };
