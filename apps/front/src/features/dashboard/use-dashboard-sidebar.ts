import { useCallback, useEffect, useState } from 'react';

const DESKTOP_QUERY = '(min-width: 960px)';
const COLLAPSED_STORAGE_KEY = 'dashboard:sidebar-collapsed';
const SIDEBAR_ID = 'dashboard-sidebar';

function getInitialDesktop() {
    if (typeof window === 'undefined') {
        return true;
    }

    return window.matchMedia(DESKTOP_QUERY).matches;
}

function getInitialCollapsed() {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
}

/**
 * Drives the dashboard app-shell sidebar across two breakpoint-scoped axes that
 * never conflict: `isOpen` is the mobile/tablet drawer, `isCollapsed` is the
 * persisted desktop collapse. The single top-bar toggle flips whichever applies
 * to the current viewport.
 */
export function useDashboardSidebar() {
    const [isDesktop, setIsDesktop] = useState(getInitialDesktop);
    const [isOpen, setIsOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsed);

    // Track the viewport and drop the off-canvas drawer state once we reach
    // desktop so it can never linger behind the persistent layout.
    useEffect(() => {
        const media = window.matchMedia(DESKTOP_QUERY);

        function handleChange(event: MediaQueryListEvent) {
            setIsDesktop(event.matches);
            if (event.matches) {
                setIsOpen(false);
            }
        }

        setIsDesktop(media.matches);
        media.addEventListener('change', handleChange);

        return () => {
            media.removeEventListener('change', handleChange);
        };
    }, []);

    // Persist the desktop collapse preference (mirrors shared/contexts/themeContext.ts).
    useEffect(() => {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(isCollapsed));
    }, [isCollapsed]);

    // While the mobile drawer is open: lock background scroll and close on Escape.
    useEffect(() => {
        if (isDesktop || !isOpen) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        }

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isDesktop, isOpen]);

    const toggle = useCallback(() => {
        if (isDesktop) {
            setIsCollapsed((value) => !value);
        } else {
            setIsOpen((value) => !value);
        }
    }, [isDesktop]);

    const close = useCallback(() => {
        setIsOpen(false);
    }, []);

    return {
        sidebarId: SIDEBAR_ID,
        isDesktop,
        isOpen,
        isCollapsed,
        toggle,
        close,
    };
}
