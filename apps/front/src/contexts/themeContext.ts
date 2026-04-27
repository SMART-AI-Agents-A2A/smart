import { createContext, useContext, useEffect, useState, createElement } from 'react';

export type Theme = 'light' | 'dark' | 'system';
type ThemeContextType = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
};

interface Props {
    children: React.ReactNode;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: Props) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        return (localStorage.getItem('theme') as Theme | null) ?? 'system';
    });

    const setTheme = (next: Theme) => {
        localStorage.setItem('theme', next);
        setThemeState(next);
    };

    useEffect(() => {
        if (theme === 'system') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }, [theme]);

    return createElement(ThemeContext.Provider, { value: { theme, setTheme } }, children);
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme outside of ThemeProvider');
    return context;
};
