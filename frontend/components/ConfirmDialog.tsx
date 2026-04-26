"use client";

import { ReactNode } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    /** Body of the dialog. Plain string for short messages, ReactNode
     *  for richer (e.g. emphasised consequence) layouts. */
    description: ReactNode;
    /** Label of the destructive action button (e.g. "Löschen"). */
    confirmLabel: string;
    /** Label of the cancel action (e.g. "Abbrechen"). Defaults to common.cancel. */
    cancelLabel?: string;
    /** "danger" renders the confirm button red; "default" uses primary. */
    variant?: "danger" | "default";
    onConfirm: () => void;
    onCancel: () => void;
    isProcessing?: boolean;
}

/**
 * Accessible confirmation dialog. Replaces ``window.confirm()`` for
 * destructive actions. Built on the project's Modal component, so it
 * inherits the focus trap, Escape-to-close, click-outside-to-close,
 * and the dark/light-mode background fix that landed in the
 * Iteration-1 a11y commit.
 *
 * The danger variant renders the confirm button in red so the
 * destructive nature is colour-coded — paired with the consequence
 * text in ``description`` so colour is not the sole signal (WCAG 1.4.1).
 */
export function ConfirmDialog({
    isOpen,
    title,
    description,
    confirmLabel,
    cancelLabel,
    variant = "danger",
    onConfirm,
    onCancel,
    isProcessing = false,
}: ConfirmDialogProps) {
    return (
        <Modal isOpen={isOpen} onClose={onCancel} title={title}>
            <div className="space-y-4">
                <div className="text-sm leading-relaxed">
                    {description}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
                        {cancelLabel ?? "Abbrechen"}
                    </Button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className={
                            variant === "danger"
                                ? "btn-base px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                : "btn-base btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        }
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
