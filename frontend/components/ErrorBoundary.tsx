import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            // Class component cannot consume the I18nContext hook, and the
            // boundary may render before/around the provider. We use German
            // (Swiss orthography) as the primary copy and English as a
            // fallback line below — covers the CH-focused pilot audience
            // without crashing the boundary itself on a translation lookup.
            return (
                <div
                    role="alert"
                    aria-live="assertive"
                    className="p-6 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-center"
                >
                    <h2 className="text-xl font-bold mb-2">Etwas ist schiefgelaufen</h2>
                    <p className="mb-2">
                        Beim Anzeigen dieser Seite ist ein Fehler aufgetreten.
                    </p>
                    <p className="mb-4 text-sm opacity-80">
                        Something went wrong while rendering this view.
                    </p>
                    <button
                        type="button"
                        className="px-4 py-2 bg-red-800 text-white rounded hover:bg-red-700 transition-colors"
                        onClick={() => window.location.reload()}
                    >
                        Seite neu laden
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
