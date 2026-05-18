import { useState, type SyntheticEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from '@base-ui/react/button';
import { Field } from '@base-ui/react/field';
import { Input } from '@base-ui/react/input';
import { Eye, EyeOff } from 'lucide-react';
import { authClient } from './api/auth-client';

type AuthMode = 'signin' | 'signup';

type AuthScreenProps = {
    mode: AuthMode;
};

const copy = {
    signin: {
        title: 'Bem-vindo de volta',
        subtitle: 'Entre para consultar metricas do cafesal.',
        submit: 'Entrar',
        switchText: 'Novo por aqui?',
        switchAction: 'Criar conta',
        switchTo: '/signup',
    },
    signup: {
        title: 'Crie sua conta',
        subtitle: 'Comece com uma visao clara do cafe.',
        submit: 'Criar conta',
        switchText: 'Ja tem conta?',
        switchAction: 'Entrar',
        switchTo: '/signin',
    },
} as const;

export function AuthScreen({ mode }: AuthScreenProps) {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const currentCopy = copy[mode];

    async function handleEmailSubmit(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        const form = new FormData(event.currentTarget);
        const email = getFormValue(form, 'email');
        const password = getFormValue(form, 'password');
        const name = getFormValue(form, 'name') || 'Cafezal';

        const response =
            mode === 'signin'
                ? await authClient.signIn.email({ email, password, rememberMe: true })
                : await authClient.signUp.email({ name, email, password });

        setIsSubmitting(false);

        if (response.error) {
            setError(response.error.message ?? 'Nao foi possivel autenticar agora.');
            return;
        }

        await navigate({ to: '/dashboard' });
    }

    async function handleGoogleSignIn() {
        setError(null);
        const response = await authClient.signIn.social({
            provider: 'google',
            callbackURL: `${window.location.origin}/dashboard`,
        });

        if (response.error) {
            setError(response.error.message ?? 'Nao foi possivel iniciar com Google.');
            return;
        }

        if (response.data?.url) {
            window.location.href = response.data.url;
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-shell" aria-labelledby="auth-title">
                <div className="auth-mark" aria-hidden="true">
                    <svg viewBox="0 0 40 40" role="img">
                        <circle cx="20" cy="20" r="17" />
                        <rect x="11" y="11" width="18" height="18" rx="3" />
                        <path d="M16 23c.7.7 1.7 1 3 1 1.7 0 3-.8 3-2 0-1-.8-1.6-2.4-1.9l-.9-.2c-1-.2-1.4-.5-1.4-1 0-.6.6-1 1.5-1 1 0 1.6.4 1.9 1l1.5-.5c-.4-1.2-1.5-1.9-3.1-1.9-1.7 0-2.9.9-2.9 2.2 0 1.1.8 1.7 2.2 2l.9.2c1 .2 1.5.5 1.5 1.1 0 .7-.7 1-1.7 1s-1.8-.4-2.2-1.2L16 23Z" />
                    </svg>
                </div>

                <header className="auth-header">
                    <h1 id="auth-title">{currentCopy.title}</h1>
                    <p>{currentCopy.subtitle}</p>
                </header>

                <div className="auth-providers auth-providers-single">
                    <Button
                        className="auth-button auth-button-secondary"
                        type="button"
                        onClick={handleGoogleSignIn}
                    >
                        <GoogleIcon />
                        Google
                    </Button>
                </div>

                <div className="auth-separator">
                    <span />
                    <p>Ou continue com email</p>
                    <span />
                </div>

                <form className="auth-form" onSubmit={handleEmailSubmit}>
                    {mode === 'signup' ? (
                        <Field.Root className="auth-field" name="name">
                            <Field.Label className="auth-label">Nome</Field.Label>
                            <Input
                                className="auth-input"
                                autoComplete="name"
                                placeholder="Seu nome"
                                required
                            />
                        </Field.Root>
                    ) : null}

                    <Field.Root className="auth-field" name="email">
                        <Field.Label className="auth-label">Email</Field.Label>
                        <Input
                            className="auth-input"
                            autoComplete="email"
                            inputMode="email"
                            placeholder="voce@exemplo.com"
                            required
                            type="email"
                        />
                    </Field.Root>

                    <Field.Root className="auth-field" name="password">
                        <Field.Label className="auth-label">Senha</Field.Label>
                        <div className="auth-input-group">
                            <Input
                                className="auth-input"
                                autoComplete={
                                    mode === 'signin' ? 'current-password' : 'new-password'
                                }
                                minLength={8}
                                placeholder="Digite sua senha"
                                required
                                type={showPassword ? 'text' : 'password'}
                            />
                            <Button
                                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                className="auth-icon-button"
                                type="button"
                                onClick={() => setShowPassword((value) => !value)}
                            >
                                {showPassword ? (
                                    <EyeOff aria-hidden="true" size={16} />
                                ) : (
                                    <Eye aria-hidden="true" size={16} />
                                )}
                            </Button>
                        </div>
                    </Field.Root>

                    {error ? <p className="auth-error">{error}</p> : null}

                    <Button
                        className="auth-button auth-button-primary"
                        disabled={isSubmitting}
                        type="submit"
                    >
                        {isSubmitting ? 'Aguarde...' : currentCopy.submit}
                    </Button>
                </form>

                <footer className="auth-footer">
                    {mode === 'signin' ? (
                        <a href="mailto:suporte@smart.local">Esqueci a senha</a>
                    ) : (
                        <span />
                    )}
                    <p>
                        {currentCopy.switchText}{' '}
                        <Link to={currentCopy.switchTo}>{currentCopy.switchAction}</Link>
                    </p>
                </footer>
            </section>
        </main>
    );
}

function getFormValue(form: FormData, key: string) {
    const value = form.get(key);
    return typeof value === 'string' ? value : '';
}

function GoogleIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="auth-provider-icon">
            <path
                d="M12 5c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.5 15 .5 12 .5 7.3.5 3.3 3.2 1.4 7.1l3.8 3c.9-2.8 3.5-4.6 6.8-4.6Z"
            />
            <path
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.7-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.6Z"
            />
            <path
                d="M5.2 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1l-3.8-3C.5 8.7 0 10.3 0 12s.5 3.3 1.4 4.7l3.8-2.6Z"
            />
            <path
                d="M12 23.5c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.3 0-6-2-6.9-4.6l-3.8 3C3.3 20.8 7.3 23.5 12 23.5Z"
            />
        </svg>
    );
}
