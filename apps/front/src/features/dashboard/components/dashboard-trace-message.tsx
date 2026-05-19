import { formatScore } from '../dashboard.service';
import type { OrchestratorTrace } from '../dashboard.type';

type DashboardTraceMessageProps = {
    trace: OrchestratorTrace | null;
    isThinking: boolean;
};

export function DashboardTraceMessage({ trace, isThinking }: DashboardTraceMessageProps) {
    if (!trace) {
        return (
            <article className="dashboard-trace" aria-live="polite">
                <details className="dashboard-trace-accordion" open>
                    <summary className={isThinking ? 'dashboard-trace-thinking' : undefined}>
                        Thinking
                    </summary>
                    <p>Analisando RAG, rota e agente necessario.</p>
                </details>
            </article>
        );
    }

    return (
        <article className="dashboard-trace" aria-live="polite">
            <details className="dashboard-trace-accordion" open>
                <summary className={isThinking ? 'dashboard-trace-thinking' : undefined}>
                    Thinking
                </summary>
                <div>
                    <ul>
                        {trace.thinking.map((item, index) => (
                            <li key={`${item}-${index}`}>{item}</li>
                        ))}
                    </ul>
                </div>
            </details>

            <details className="dashboard-trace-accordion" open>
                <summary>Agent calling</summary>
                <p>
                    {trace.agentCall.called
                        ? `${trace.agentCall.agentName} executou ${trace.agentCall.action}.`
                        : 'Nenhum agente chamado. Resposta direta pelo orquestrador.'}
                </p>
            </details>

            <details className="dashboard-trace-accordion" open>
                <summary>References</summary>
                {trace.references.length > 0 ? (
                    <ul>
                        {trace.references.map((source, index) => (
                            <li key={`${source.key}-${source.score}-${index}`}>
                                <span>{source.key}</span>
                                <small>score {formatScore(source.score)}</small>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>Nenhuma referencia RAG retornada para esta pergunta.</p>
                )}
            </details>
        </article>
    );
}
