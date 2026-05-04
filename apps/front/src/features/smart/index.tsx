import { createFileRoute } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { Button } from '@base-ui/react/button';
import { Archive, BellOff, CheckCheck, Sparkles } from 'lucide-react';

export const Route = createFileRoute('/')({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <main className="smart-page">
            <section className="smart-screen" aria-labelledby="smart-title">
                <div className="smart-status">
                    <CheckCheck aria-hidden="true" size={14} />
                    Smart · 0 pendencias
                </div>

                <div className="smart-week" aria-label="Resumo da semana">
                    <span>Hoje</span>
                    <strong>12 resolvidas</strong>
                </div>

                <div className="smart-stage" aria-hidden="true">
                    <div className="smart-horizon" />
                    <article className="smart-card smart-card-main">
                        <span>Agora</span>
                        <strong>Quieto</strong>
                    </article>
                    <article className="smart-card smart-card-left">
                        <span>Entrada</span>
                        <strong>Limpa</strong>
                    </article>
                    <article className="smart-card smart-card-right">
                        <span>Foco</span>
                        <strong>Livre</strong>
                    </article>
                </div>

                <div className="smart-copy">
                    <div className="smart-kicker">
                        <Sparkles aria-hidden="true" size={13} />
                        Tudo no lugar
                    </div>
                    <h1 id="smart-title">Seu trabalho em ordem.</h1>
                    <p>Agents para consultar metricas do cafezal e decidir o proximo manejo.</p>
                    <div className="smart-actions">
                        <Button
                            className="smart-button smart-button-primary"
                            nativeButton={false}
                            render={<Link to="/signin" />}
                        >
                            <Archive aria-hidden="true" size={16} />
                            Entrar
                        </Button>
                        <Button
                            className="smart-button smart-button-ghost"
                            nativeButton={false}
                            render={<Link to="/signup" />}
                        >
                            <BellOff aria-hidden="true" size={16} />
                            Criar conta
                        </Button>
                    </div>
                </div>
            </section>
        </main>
    );
}
