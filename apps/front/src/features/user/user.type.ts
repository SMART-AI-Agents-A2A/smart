export type AuthMode = 'signin' | 'signup';

export type AuthScreenProps = {
    mode: AuthMode;
};

export type AuthCopy = {
    title: string;
    subtitle: string;
    submit: string;
    switchText: string;
    switchAction: string;
    switchTo: '/signin' | '/signup';
};
