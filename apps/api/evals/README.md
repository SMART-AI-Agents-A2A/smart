# Smart Prompt Evals

Pipeline local para avaliar variantes de prompt do orquestrador Smart e gerar um arquivo `ragas.jsonl` para ser usado como entrada do RAGAS em outro repositorio.

O RAGAS nao roda neste projeto. Este projeto apenas executa os cases, coleta resposta + contextos recuperados pelo RAG da Cloudflare e exporta o dataset flat esperado pelo avaliador externo.

## Entradas

- `apps/api/evals/cases/db.json`: perguntas, referencias esperadas e metadados importados do banco de casos.
- `apps/api/evals/variants/*.json`: variantes de prompt aplicadas ao router, ao prompt final ou aos dois.
- `apps/api/evals/run-config.sample.json`: configuracao padrao do runner local.

## Saidas

Cada execucao grava em `apps/api/evals/runs/<run-id>/`:

- `manifest.json`: metadados da execucao.
- `results.jsonl`: checkpoint bruto incremental, uma linha por `caseId::variantId`.
- `results.json`: copia pretty-print do `results.jsonl` para leitura na IDE.
- `ragas.jsonl`: entrada flat para RAGAS, gerada apenas com resultados `success`, sem fallback de modelo e com `retrieved_contexts` do RAG.

## Rodar

Rodar a matriz completa e exportar `ragas.jsonl` ao final:

```bash
vp run api#eval:run -- --cases-path apps/api/evals/cases/db.json --strict-model --export-ragas
```

Retomar uma run existente depois de quota, limite ou interrupcao:

```bash
vp run api#eval:run -- --resume <runId> --strict-model --export-ragas
```

Exportar `ragas.jsonl` a partir de um `results.jsonl` ja existente, sem reexecutar o eval:

```bash
vp run api#eval:export-ragas -- --input apps/api/evals/runs/<runId>/results.jsonl --output apps/api/evals/runs/<runId>/ragas.jsonl
```

## Trocar Modelo

Nao precisa criar outra config para testar outro modelo. Use `--model` no comando; ele sobrescreve o modelo definido em `run-config.sample.json`.

```bash
vp run api#eval:run -- --model openai-gpt-4o-mini --strict-model --export-ragas
```

Modelos disponiveis atualmente:

- `claude-sonnet-4-6`
- `openai-gpt-4o-mini`
- `workers-qwen-30b`
- `gpt-5-4`
- `kimi-k2-7`
- `glm-5-1`

## Filtros Uteis

Rodar uma variante:

```bash
vp run api#eval:run -- --variant baseline --strict-model --export-ragas
```

Rodar um case em todas as variantes:

```bash
vp run api#eval:run -- --case db-45 --strict-model --export-ragas
```

Rodar uma combinacao especifica:

```bash
vp run api#eval:run -- --case db-45 --variant cot-router --strict-model --export-ragas
```

Continuar a partir de um ponto da matriz:

```bash
vp run api#eval:run -- --from-case db-47 --from-variant cot-router --strict-model --export-ragas
```

## Matriz Atual

A matriz atual usa 30 cases e 13 variantes, totalizando `30 x 13 = 390` execucoes.

Variantes disponiveis:

- `baseline`
- `cot-both`, `cot-final`, `cot-router`
- `few-shot-both`, `few-shot-final`, `few-shot-router`
- `rar-both`, `rar-final`, `rar-router`
- `tsb-both`, `tsb-final`, `tsb-router`

## Contrato Do ragas.jsonl

Cada linha do `ragas.jsonl` representa uma resposta avaliada e contem:

```json
{
    "user_input": "...",
    "response": "...",
    "retrieved_contexts": ["..."],
    "reference": "...",
    "reference_contexts": ["..."],
    "case_id": "db-45",
    "variant_id": "baseline",
    "strategy": "baseline",
    "route": "multi-agent",
    "rag_count": 2,
    "model": "anthropic/claude-sonnet-4.6",
    "duration_ms": 36386,
    "run_id": "..."
}
```

Campos principais para RAGAS:

- `user_input`: pergunta do case.
- `response`: resposta gerada pelo orquestrador.
- `retrieved_contexts`: trechos recuperados pelo RAG da Cloudflare.
- `reference`: resposta de referencia usada como ground truth.
- `reference_contexts`: contexto tecnico de referencia importado do case.
