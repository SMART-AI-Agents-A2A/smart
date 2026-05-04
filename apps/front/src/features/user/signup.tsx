import { createFileRoute } from '@tanstack/react-router';
import { AuthScreen } from './auth-screen';

export const Route = createFileRoute('/signup')({
    component: RouteComponent,
});

function RouteComponent() {
    return <AuthScreen mode="signup" />;
}
