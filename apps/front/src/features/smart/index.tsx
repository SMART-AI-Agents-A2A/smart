import { createFileRoute } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { Button } from '@base-ui/react/button';
import { Archive, BellOff, CheckCheck, Sparkles } from 'lucide-react';
import { smartScreenContent, smartStageCards } from './smart.service';

export const Route = createFileRoute('/')({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <main className="smart-page">
            <section className="smart-screen" aria-labelledby="smart-title">
                <div className="smart-status">
                    <CheckCheck aria-hidden="true" size={14} />
                    {smartScreenContent.statusLabel}
                </div>

                <div className="smart-week" aria-label="Resumo da semana">
                    <span>{smartScreenContent.weekLabel}</span>
                    <strong>{smartScreenContent.weekValue}</strong>
                </div>

                <div className="smart-stage" aria-hidden="true">
                    <div className="smart-horizon" />
                    {smartStageCards.map((card) => (
                        <article className={card.className} key={card.key}>
                            <span>{card.label}</span>
                            <strong>{card.value}</strong>
                        </article>
                    ))}
                </div>

                <div className="smart-copy">
                    <div className="smart-kicker">
                        <Sparkles aria-hidden="true" size={13} />
                        {smartScreenContent.kicker}
                    </div>
                    <h1 id="smart-title">{smartScreenContent.title}</h1>
                    <p>{smartScreenContent.description}</p>
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
