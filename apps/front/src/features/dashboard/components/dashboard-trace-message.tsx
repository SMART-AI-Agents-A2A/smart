import { formatScore } from '../dashboard.service';
import type { OrchestratorTrace, PrimaryAiStatusPhase } from '../dashboard.type';

type DashboardTraceMessageProps = {
    trace: OrchestratorTrace | null;
    thinking: Array<string>;
    activePhase: PrimaryAiStatusPhase | null;
    agentName?: string | null;
    agentStatus?: string | null;
};

function isActivePhase(activePhase: PrimaryAiStatusPhase | null, phase: PrimaryAiStatusPhase) {
    return activePhase === phase ? 'true' : undefined;
}

function mergeThinkingItems(liveItems: Array<string>, trace: OrchestratorTrace | null) {
    const items = [...liveItems];

    for (const item of trace?.thinking ?? []) {
        if (!items.includes(item)) {
            items.push(item);
        }
    }

    return items;
}

export function DashboardTraceMessage({
    trace,
    thinking,
    activePhase,
    agentName,
    agentStatus,
}: DashboardTraceMessageProps) {
    const thinkingItems = mergeThinkingItems(thinking, trace);
    const liveAgentName = trace?.agentCall.agentName ?? agentName ?? null;
    const shouldShowAgentCalling =
        Boolean(trace) || activePhase === 'agent-calling' || Boolean(liveAgentName);
    let agentCallDescription = 'Nenhum agente chamado. Resposta direta pelo orquestrador.';

    if (liveAgentName) {
        agentCallDescription = `${liveAgentName} em chamada.`;
    }

    if (agentStatus) {
        agentCallDescription = agentStatus;
    }

    if (trace?.agentCall.called) {
        agentCallDescription = `${trace.agentCall.agentName} executou ${trace.agentCall.action}.`;
    }

    return (
        <article
            aria-busy={activePhase === 'thinking' || activePhase === 'agent-calling'}
            className="dashboard-trace"
            aria-live="polite"
        >
            <details className="dashboard-trace-accordion" open>
                <summary data-active={isActivePhase(activePhase, 'thinking')}>
                    <span>Thinking</span>
                </summary>
                {thinkingItems.length > 0 ? (
                    <ul>
                        {thinkingItems.map((item, index) => (
                            <li key={`${item}-${index}`}>{item}</li>
                        ))}
                    </ul>
                ) : (
                    <p>Analisando RAG, rota e agente necessario.</p>
                )}
            </details>

            {shouldShowAgentCalling ? (
                <details className="dashboard-trace-accordion" open>
                    <summary data-active={isActivePhase(activePhase, 'agent-calling')}>
                        <span>Agent calling</span>
                    </summary>
                    <p>{agentCallDescription}</p>
                </details>
            ) : null}

            {trace ? (
                <details className="dashboard-trace-accordion" open>
                    <summary>
                        <span>Contexto RAG</span>
                    </summary>
                    {trace.references.length > 0 ? (
                        <ul className="dashboard-rag-sources" aria-label="Fontes de contexto RAG">
                            {trace.references.map((source, index) => (
                                <li
                                    className="dashboard-rag-source"
                                    key={`${source.key}-${source.score}-${index}`}
                                >
                                    <span className="dashboard-rag-source-key" title={source.key}>
                                        {source.key.split('/').at(-1) ?? source.key}
                                    </span>
                                    <span
                                        className="dashboard-rag-source-score"
                                        aria-label={`Score de relevancia: ${formatScore(source.score)}`}
                                    >
                                        {formatScore(source.score)}
                                    </span>
                                    <span
                                        className="dashboard-rag-source-bar"
                                        style={{ width: `${Math.round(source.score * 100)}%` }}
                                        aria-hidden="true"
                                    />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>Nenhuma referencia RAG retornada para esta pergunta.</p>
                    )}
                </details>
            ) : null}
        </article>
    );
}
