import Link from "next/link";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "outline";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
}

export function Button({
  children,
  onClick,
  href,
  variant = "primary",
  type = "button",
  disabled = false,
  className = "",
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold transition-all duration-200";

  const variantStyles = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed",
    secondary:
      "bg-slate-700 text-white hover:bg-slate-600 disabled:bg-slate-500 disabled:cursor-not-allowed",
    outline:
      "border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 disabled:border-indigo-300 disabled:text-indigo-300 disabled:cursor-not-allowed",
  };

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={combinedClassName}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={combinedClassName}
    >
      {children}
    </button>
  );
}
