import { authClient } from './api/auth-client';
import type { AuthCopy, AuthMode } from './user.type';

const authCopyByMode: Record<AuthMode, AuthCopy> = {
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
};

export function getAuthCopy(mode: AuthMode) {
    return authCopyByMode[mode];
}

export function getFormValue(form: FormData, key: string) {
    const value = form.get(key);
    return typeof value === 'string' ? value : '';
}

export async function authenticateWithEmail(params: {
    mode: AuthMode;
    email: string;
    password: string;
    name: string;
}) {
    if (params.mode === 'signin') {
        return authClient.signIn.email({
            email: params.email,
            password: params.password,
            rememberMe: true,
        });
    }

    return authClient.signUp.email({
        name: params.name,
        email: params.email,
        password: params.password,
    });
}

export async function authenticateWithGoogle(callbackURL: string) {
    return authClient.signIn.social({
        provider: 'google',
        callbackURL,
    });
}
