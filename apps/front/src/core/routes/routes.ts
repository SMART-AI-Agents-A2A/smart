import { rootRoute, index, route } from '@tanstack/virtual-file-routes';

export const routes = rootRoute('core/routes/__root.tsx', [
    index('features/smart/index.tsx'),
    route('/signin', 'features/user/signin.tsx'),
    route('/signup', 'features/user/signup.tsx'),
    route('/dashboard', 'features/dashboard/index.tsx'),
    // route('/chat', 'features/chat/index.tsx'),
    // route('/sobre', 'features/siacmica/sobre.tsx'),
    // route('/roadmap', 'features/roadmap/index.tsx', [
    //     route('/cursos', 'features/roadmap/cursos/index.tsx', [
    //         route('/$path', 'features/roadmap/cursos/$path.tsx'),
    //     ]),
    // ]),
    // route('/login', 'features/auth/index.tsx'),
    // route('/dashboard', 'features/dashboard/index.tsx'),
]);
