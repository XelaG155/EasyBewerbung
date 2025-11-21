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
  const baseStyles = "btn-base";

  const variantStyles = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    outline: "btn-outline",
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
