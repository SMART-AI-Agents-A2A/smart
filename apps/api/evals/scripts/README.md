## Avaliar Com RAGAS

O script `apps/api/evals/scripts/ragas.py` avalia os `ragas.jsonl` ja exportados, usando `z-ai/glm-5.1` como juiz via OpenRouter por padrao.

Ele le a chave `OPENROUTER_API_KEY` de `apps/api/.env`.

Por padrao, a metrica rodada e `Faithfulness`, porque ela usa LLM judge e funciona com OpenRouter. Para `Response Relevance`, tambem e necessario configurar embeddings.

Teste rapido de cada modelo, antes de rodar completo:

```bash
python ./apps/api/evals/scripts/ragas.py --target-model deepseek-v32 --max-rows 2
python ./apps/api/evals/scripts/ragas.py --target-model deepseek-v4-pro --max-rows 2
python ./apps/api/evals/scripts/ragas.py --target-model gpt-5-4-mini --max-rows 2
python ./apps/api/evals/scripts/ragas.py --target-model claude-haiku-4-5 --max-rows 2
```

Rodar a avaliacao completa por modelo:

```bash
python ./apps/api/evals/scripts/ragas.py --target-model deepseek-v32
python ./apps/api/evals/scripts/ragas.py --target-model deepseek-v4-pro
python ./apps/api/evals/scripts/ragas.py --target-model gpt-5-4-mini
python ./apps/api/evals/scripts/ragas.py --target-model claude-haiku-4-5
```

Cada comando exporta CSV e JSONL com prefixo do modelo avaliado:

```text
apps/api/evals/ragas-results/deepseek-v32_ragas_scores.csv
apps/api/evals/ragas-results/deepseek-v4-pro_ragas_scores.csv
apps/api/evals/ragas-results/gpt-5-4-mini_ragas_scores.csv
apps/api/evals/ragas-results/claude-haiku-4-5_ragas_scores.csv
```

Se o juiz cortar a resposta por limite de tokens, aumente o limite:

```bash
python ./apps/api/evals/scripts/ragas.py --target-model deepseek-v32 --llm-max-tokens 8192
```

Se a execucao cair no meio, rode o mesmo comando novamente. O script usa o `.jsonl` de saida como checkpoint, pula o que ja foi avaliado e continua a partir do que ficou pendente:

```bash
python ./apps/api/evals/scripts/ragas.py --target-model deepseek-v32
```

Se alguma linha foi salva com erro e voce quiser tentar de novo depois de ajustar token, modelo ou rede, use `--retry-errors`:

```bash
python ./apps/api/evals/scripts/ragas.py --target-model deepseek-v32 --retry-errors --llm-max-tokens 16000
```
