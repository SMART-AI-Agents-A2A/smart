import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ThemeProvider } from './shared/contexts';
import TanStackQueryProvider from './core/tanstack-query/root-provider.tsx';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider>
            <TanStackQueryProvider>
                <App />
            </TanStackQueryProvider>
        </ThemeProvider>
    </StrictMode>,
);
