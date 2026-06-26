from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import types
from pathlib import Path
from typing import Any


DEFAULT_RUNS = {
    "DeepSeek V3.2": "apps/api/evals/runs/deepseek-v32-2026-06-22/ragas.jsonl",
    "DeepSeek V4 Pro": "apps/api/evals/runs/deepseek-v4-pro-2026-06-22/ragas.jsonl",
    "GPT 5.4 Mini": "apps/api/evals/runs/gpt-5-4-mini-2026-06-26/ragas.jsonl",
    "Claude Haiku 4.5": "apps/api/evals/runs/claude-haiku-4-5-2026-06-26/ragas.jsonl",
}

DEFAULT_OUTPUT = "apps/api/evals/ragas-results/ragas_scores"
DEFAULT_ENV_FILE = "apps/api/.env"
DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def repo_root() -> Path:
    current = Path(__file__).resolve()

    for parent in [current.parent, *current.parents]:
        if (parent / "pnpm-workspace.yaml").exists() and (parent / "apps").exists():
            return parent

    return Path.cwd()


def resolve_path(path: str | Path) -> Path:
    value = Path(path)
    if value.is_absolute():
        return value
    return repo_root() / value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate exported Smart prompt runs with official RAGAS metrics."
    )
    parser.add_argument(
        "--run",
        action="append",
        default=[],
        metavar="LABEL=PATH",
        help=(
            "Input ragas.jsonl. Example: "
            '--run "GPT 5.4 Mini=apps/api/evals/runs/gpt-5-4-mini-2026-06-26/ragas.jsonl"'
        ),
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help="Output path without extension. CSV and JSONL will be created.",
    )
    parser.add_argument(
        "--env-file",
        default=DEFAULT_ENV_FILE,
        help="Optional .env file to load before running RAGAS.",
    )
    parser.add_argument(
        "--llm-model",
        default=os.getenv("RAGAS_LLM_MODEL", "openai/gpt-4o-mini"),
        help="Evaluator LLM model.",
    )
    parser.add_argument(
        "--llm-base-url",
        default=os.getenv("RAGAS_LLM_BASE_URL")
        or os.getenv("OPENROUTER_BASE_URL")
        or DEFAULT_OPENROUTER_BASE_URL,
        help="Optional OpenAI-compatible base URL for the evaluator LLM.",
    )
    parser.add_argument(
        "--llm-api-key-env",
        default=os.getenv("RAGAS_LLM_API_KEY_ENV", "OPENROUTER_API_KEY"),
        help="Environment variable containing the evaluator LLM API key.",
    )
    parser.add_argument(
        "--llm-max-tokens",
        type=int,
        default=int(os.getenv("RAGAS_LLM_MAX_TOKENS", "4096")),
        help="Maximum output tokens for the evaluator LLM.",
    )
    parser.add_argument(
        "--metrics",
        default=os.getenv("RAGAS_METRICS", "faithfulness"),
        help=(
            "Comma-separated metrics: faithfulness,response_relevance. "
            "Response relevance requires an embeddings API key."
        ),
    )
    parser.add_argument(
        "--embedding-model",
        default=os.getenv("RAGAS_EMBEDDING_MODEL", "text-embedding-3-small"),
        help="Embedding model used by Response Relevancy.",
    )
    parser.add_argument(
        "--embedding-base-url",
        default=os.getenv("RAGAS_EMBEDDING_BASE_URL") or os.getenv("OPENAI_BASE_URL"),
        help="Optional OpenAI-compatible base URL for embeddings.",
    )
    parser.add_argument(
        "--embedding-api-key-env",
        default=os.getenv("RAGAS_EMBEDDING_API_KEY_ENV", "OPENAI_API_KEY"),
        help="Environment variable containing the embedding API key.",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=0,
        help="Limit rows for a quick paid test. Use 0 for all rows.",
    )
    parser.add_argument(
        "--skip-empty-contexts",
        action="store_true",
        help="Skip rows without retrieved_contexts, useful because Faithfulness needs context.",
    )
    return parser.parse_args()


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def parse_runs(raw_runs: list[str]) -> dict[str, Path]:
    if not raw_runs:
        return {label: resolve_path(path) for label, path in DEFAULT_RUNS.items()}

    runs: dict[str, Path] = {}
    for item in raw_runs:
        if "=" not in item:
            raise SystemExit(f"Invalid --run value: {item}. Use LABEL=PATH.")
        label, path = item.split("=", 1)
        runs[label.strip()] = resolve_path(path.strip())

    return runs


def as_text_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]


def load_rows(runs: dict[str, Path], *, skip_empty_contexts: bool, max_rows: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for model_label, input_path in runs.items():
        if not input_path.exists():
            print(f"Skipping missing input: {model_label} -> {input_path}")
            continue

        with input_path.open("r", encoding="utf-8-sig") as file:
            for line_number, line in enumerate(file, start=1):
                if not line.strip():
                    continue

                item = json.loads(line)
                contexts = as_text_list(item.get("retrieved_contexts"))

                if skip_empty_contexts and not contexts:
                    continue

                rows.append(
                    {
                        "source_file": str(input_path),
                        "source_line": line_number,
                        "model_label": model_label,
                        "model": str(item.get("model") or ""),
                        "run_id": str(item.get("run_id") or ""),
                        "case_id": str(item.get("case_id") or ""),
                        "variant_id": str(item.get("variant_id") or ""),
                        "strategy": str(item.get("strategy") or ""),
                        "route": str(item.get("route") or ""),
                        "rag_count": item.get("rag_count"),
                        "duration_ms": item.get("duration_ms"),
                        "user_input": str(item.get("user_input") or ""),
                        "response": str(item.get("response") or ""),
                        "retrieved_contexts": contexts,
                        "reference": str(item.get("reference") or ""),
                        "reference_contexts": as_text_list(item.get("reference_contexts")),
                    }
                )

                if max_rows > 0 and len(rows) >= max_rows:
                    return rows

    return rows


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"Missing environment variable: {name}")
    return value


def selected_metrics(raw_metrics: str) -> set[str]:
    aliases = {
        "f": "faithfulness",
        "faithfulness": "faithfulness",
        "rr": "response_relevance",
        "response_relevance": "response_relevance",
        "response_relevancy": "response_relevance",
        "answer_relevance": "response_relevance",
        "answer_relevancy": "response_relevance",
    }
    metrics = set()

    for item in raw_metrics.split(","):
        value = item.strip().lower().replace("-", "_")
        if not value:
            continue
        if value not in aliases:
            raise SystemExit(
                f"Unknown metric: {item}. Use faithfulness,response_relevance."
            )
        metrics.add(aliases[value])

    if not metrics:
        raise SystemExit("No metrics selected.")

    return metrics


def install_ragas_vertexai_import_shim() -> None:
    if "langchain_community.chat_models.vertexai" in sys.modules:
        return

    module = types.ModuleType("langchain_community.chat_models.vertexai")

    class ChatVertexAI:  # noqa: D401
        """Import shim for ragas when VertexAI is not installed."""

    module.ChatVertexAI = ChatVertexAI
    sys.modules["langchain_community.chat_models.vertexai"] = module


def build_ragas_scorers(args: argparse.Namespace) -> tuple[Any | None, Any | None]:
    script_dir = Path(__file__).resolve().parent
    sys.path = [path for path in sys.path if Path(path or ".").resolve() != script_dir]
    install_ragas_vertexai_import_shim()
    metrics = selected_metrics(args.metrics)

    try:
        from openai import AsyncOpenAI
        from ragas.llms import llm_factory
        from ragas.metrics.collections import AnswerRelevancy, Faithfulness
        if "response_relevance" in metrics:
            from ragas.embeddings.base import embedding_factory
        else:
            embedding_factory = None
    except ImportError as error:
        raise SystemExit(
            "Missing dependencies. Install them before running this script:\n"
            "python -m pip install ragas openai\n\n"
            f"Import error: {error}"
        ) from error

    llm_api_key = require_env(args.llm_api_key_env)

    llm_client_kwargs: dict[str, Any] = {"api_key": llm_api_key}
    if args.llm_base_url:
        llm_client_kwargs["base_url"] = args.llm_base_url

    llm_client = AsyncOpenAI(**llm_client_kwargs)
    llm = llm_factory(
        args.llm_model,
        client=llm_client,
        max_completion_tokens=args.llm_max_tokens,
    )

    faithfulness = Faithfulness(llm=llm) if "faithfulness" in metrics else None
    response_relevancy = None

    if "response_relevance" in metrics:
        embedding_api_key = require_env(args.embedding_api_key_env)
        embedding_client_kwargs: dict[str, Any] = {"api_key": embedding_api_key}
        if args.embedding_base_url:
            embedding_client_kwargs["base_url"] = args.embedding_base_url

        embedding_client = AsyncOpenAI(**embedding_client_kwargs)
        embeddings = embedding_factory("openai", model=args.embedding_model, client=embedding_client)
        response_relevancy = AnswerRelevancy(llm=llm, embeddings=embeddings)

    return faithfulness, response_relevancy


def score_value(result: Any) -> float | None:
    value = getattr(result, "value", result)
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def evaluate_rows(
    rows: list[dict[str, Any]],
    faithfulness: Any | None,
    response_relevancy: Any | None,
) -> list[dict[str, Any]]:
    scored_rows: list[dict[str, Any]] = []
    total = len(rows)

    for index, row in enumerate(rows, start=1):
        print(
            f"[ragas] {index}/{total} model={row['model_label']} "
            f"variant={row['variant_id']} case={row['case_id']}"
        )

        faithfulness_score = None
        response_relevancy_score = None
        error = ""

        try:
            if faithfulness is not None and row["retrieved_contexts"]:
                faithfulness_score = score_value(
                    faithfulness.score(
                        user_input=row["user_input"],
                        response=row["response"],
                        retrieved_contexts=row["retrieved_contexts"],
                    )
                )

            if response_relevancy is not None:
                response_relevancy_score = score_value(
                    response_relevancy.score(
                        user_input=row["user_input"],
                        response=row["response"],
                    )
                )
        except Exception as exception:  # noqa: BLE001
            error = str(exception)
            print(f"[ragas] error case={row['case_id']} variant={row['variant_id']}: {error}")

        scored_rows.append(
            {
                "model_label": row["model_label"],
                "model": row["model"],
                "run_id": row["run_id"],
                "case_id": row["case_id"],
                "variant_id": row["variant_id"],
                "strategy": row["strategy"],
                "route": row["route"],
                "rag_count": row["rag_count"],
                "duration_ms": row["duration_ms"],
                "faithfulness_f": faithfulness_score,
                "response_relevance_rr": response_relevancy_score,
                "error": error,
                "source_file": row["source_file"],
                "source_line": row["source_line"],
            }
        )

    return scored_rows


def write_outputs(rows: list[dict[str, Any]], output_base: Path) -> None:
    output_base.parent.mkdir(parents=True, exist_ok=True)
    jsonl_path = output_base.with_suffix(".jsonl")
    csv_path = output_base.with_suffix(".csv")

    with jsonl_path.open("w", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(row, ensure_ascii=False) + "\n")

    fieldnames = [
        "model_label",
        "model",
        "run_id",
        "case_id",
        "variant_id",
        "strategy",
        "route",
        "rag_count",
        "duration_ms",
        "faithfulness_f",
        "response_relevance_rr",
        "error",
        "source_file",
        "source_line",
    ]
    with csv_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"[ragas] jsonl={jsonl_path}")
    print(f"[ragas] csv={csv_path}")


def main() -> int:
    args = parse_args()
    load_env_file(resolve_path(args.env_file))

    runs = parse_runs(args.run)
    rows = load_rows(
        runs,
        skip_empty_contexts=args.skip_empty_contexts,
        max_rows=args.max_rows,
    )

    if not rows:
        print("[ragas] No rows to evaluate.")
        return 1

    print(f"[ragas] rows={len(rows)}")
    faithfulness, response_relevancy = build_ragas_scorers(args)
    scored_rows = evaluate_rows(rows, faithfulness, response_relevancy)
    write_outputs(scored_rows, resolve_path(args.output))

    failed = sum(1 for row in scored_rows if row["error"])
    print(f"[ragas] done rows={len(scored_rows)} failed={failed}")

    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
