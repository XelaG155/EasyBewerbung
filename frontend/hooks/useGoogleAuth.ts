import { useState, useEffect, useCallback } from "react";

declare global {
    interface Window {
        google?: any;
    }
}

export function useGoogleAuth(
    onSuccess: (credential: string) => void,
    onError: (error: any) => void,
    elementId: string = "googleSignInButton"
) {
    const [googleLoaded, setGoogleLoaded] = useState(false);
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    const handleGoogleCallback = useCallback(
        (response: any) => {
            onSuccess(response.credential);
        },
        [onSuccess]
    );

    useEffect(() => {
        if (googleLoaded && window.google && googleClientId) {
            try {
                window.google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: handleGoogleCallback,
                });
                const element = document.getElementById(elementId);
                if (element) {
                    window.google.accounts.id.renderButton(element, {
                        theme: "filled_blue",
                        size: "large",
                        text: "signin_with",
                        width: "100%",
                    });
                }
            } catch (err) {
                onError(err);
            }
        }
    }, [googleLoaded, googleClientId, handleGoogleCallback, elementId, onError]);

    return { googleLoaded, setGoogleLoaded, googleClientId };
}
