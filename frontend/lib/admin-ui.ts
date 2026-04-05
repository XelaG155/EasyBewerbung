/**
 * Shared Tailwind class strings for the admin UI.
 *
 * Extracted so every button on the admin page, in the drawer editor, and in
 * the sync-check modal has the same rounded corners, font size, padding,
 * and — crucially — a consistent visible focus ring for keyboard-only users.
 * WCAG 2.1 Level AA requires a visible focus indicator on every interactive
 * element; before this extraction, the admin page had ~25 ad-hoc buttons
 * with no focus styles at all.
 */

// Base classes that every admin button shares: rounded, smooth transitions,
// a focus-visible ring that survives dark mode, and a disabled state.
const adminBtnBase =
  "inline-flex items-center justify-center gap-1.5 rounded font-medium " +
  "transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

// Size variants — admin UI has three density levels.
const adminBtnSize = {
  sm: "px-2 py-1 text-xs",
  md: "px-3 py-1.5 text-xs",
  lg: "px-4 py-2 text-sm",
} as const;

export type AdminBtnSize = keyof typeof adminBtnSize;

// Color variants. Each includes hover state and a focus-ring color that
// contrasts on both light and dark backgrounds.
export const adminBtn = {
  primary: (size: AdminBtnSize = "lg") =>
    `${adminBtnBase} ${adminBtnSize[size]} bg-blue-600 text-white ` +
    `hover:bg-blue-700 focus-visible:ring-blue-500`,

  secondary: (size: AdminBtnSize = "lg") =>
    `${adminBtnBase} ${adminBtnSize[size]} bg-gray-100 dark:bg-gray-800 ` +
    `text-gray-900 dark:text-gray-100 ` +
    `hover:bg-gray-200 dark:hover:bg-gray-700 ` +
    `focus-visible:ring-gray-500`,

  success: (size: AdminBtnSize = "lg") =>
    `${adminBtnBase} ${adminBtnSize[size]} bg-green-600 text-white ` +
    `hover:bg-green-700 focus-visible:ring-green-500`,

  danger: (size: AdminBtnSize = "lg") =>
    `${adminBtnBase} ${adminBtnSize[size]} bg-red-600 text-white ` +
    `hover:bg-red-700 focus-visible:ring-red-500`,

  dangerSubtle: (size: AdminBtnSize = "lg") =>
    `${adminBtnBase} ${adminBtnSize[size]} ` +
    `bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 ` +
    `hover:bg-red-200 dark:hover:bg-red-950/60 ` +
    `focus-visible:ring-red-500`,

  warning: (size: AdminBtnSize = "lg") =>
    `${adminBtnBase} ${adminBtnSize[size]} ` +
    `bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 ` +
    `hover:bg-amber-200 dark:hover:bg-amber-900/60 ` +
    `focus-visible:ring-amber-500`,

  ghost: (size: AdminBtnSize = "lg") =>
    `${adminBtnBase} ${adminBtnSize[size]} ` +
    `text-gray-600 dark:text-gray-400 ` +
    `hover:bg-gray-100 dark:hover:bg-gray-800 ` +
    `focus-visible:ring-gray-500`,
} as const;

// Icon-only close button used in modals and drawers.
export const adminIconBtn =
  "inline-flex items-center justify-center w-8 h-8 rounded " +
  "text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 " +
  "hover:bg-gray-100 dark:hover:bg-gray-800 " +
  "transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-white " +
  "dark:focus-visible:ring-offset-gray-900";

// Status badge for Aktiv/Inaktiv — uses a visible border and a dot icon so
// the state is conveyed by shape and text, not only color. Fixes WCAG 1.4.1.
export const statusBadge = {
  active:
    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium " +
    "bg-green-50 dark:bg-green-950/30 " +
    "text-green-800 dark:text-green-300 " +
    "border border-green-300 dark:border-green-800",
  inactive:
    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium " +
    "bg-gray-100 dark:bg-gray-800 " +
    "text-gray-700 dark:text-gray-400 " +
    "border border-gray-300 dark:border-gray-700",
} as const;
