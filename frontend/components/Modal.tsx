"use client";

import React, { useEffect, useId, useRef } from "react";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog with WCAG 2.1.2 (no keyboard trap on the
 * container, but tab cycle inside the dialog), 4.1.2 (role="dialog",
 * aria-modal, aria-labelledby) and the Escape-to-close pattern.
 *
 * Behaviour:
 * - Restores focus to the previously-focused element on close.
 * - On open, moves focus to the first focusable element inside.
 * - Tab and Shift+Tab cycle inside the dialog (focus trap).
 * - Escape closes.
 * - Light- and dark-mode background using CSS variables — the previous
 *   hardcoded ``bg-slate-900`` rendered black-on-light in light mode.
 */
export function Modal({ isOpen, onClose, title, children }: ModalProps) {
    const titleId = useId();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const lastActiveRef = useRef<HTMLElement | null>(null);

    // Save / restore focus around open and close.
    useEffect(() => {
        if (!isOpen) return;
        lastActiveRef.current = document.activeElement as HTMLElement | null;
        // Defer to next tick so the dialog children are mounted.
        const timer = setTimeout(() => {
            const root = containerRef.current;
            if (!root) return;
            const first = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
            (first ?? root).focus();
        }, 0);
        return () => {
            clearTimeout(timer);
            lastActiveRef.current?.focus?.();
        };
    }, [isOpen]);

    // Escape + Tab focus trap.
    useEffect(() => {
        if (!isOpen) return;

        function handleKey(event: KeyboardEvent) {
            if (event.key === "Escape") {
                event.stopPropagation();
                onClose();
                return;
            }
            if (event.key !== "Tab") return;

            const root = containerRef.current;
            if (!root) return;
            const focusables = Array.from(
                root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
            ).filter((el) => !el.hasAttribute("data-focus-skip"));
            if (focusables.length === 0) {
                event.preventDefault();
                return;
            }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement as HTMLElement | null;

            if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        }

        document.addEventListener("keydown", handleKey, true);
        return () => document.removeEventListener("keydown", handleKey, true);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => {
                // Click outside content closes.
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={containerRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in duration-200"
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 id={titleId} className="text-xl font-bold">
                        {title}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        aria-label="Schliessen"
                    >
                        <span aria-hidden="true">✕</span>
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
