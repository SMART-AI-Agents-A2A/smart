from __future__ import annotations

import argparse
import json
import re
from difflib import SequenceMatcher
from pathlib import Path
from statistics import mean
from typing import Any

import matplotlib.pyplot as plt


DEFAULT_RUNS = {
    "DeepSeek V3.2": "apps/api/evals/runs/deepseek-v32-2026-06-22",
    "DeepSeek V4 Pro": "apps/api/evals/runs/deepseek-v4-pro-2026-06-22",
    "GPT 5.4 Mini": "apps/api/evals/runs/gpt-5-4-mini-2026-06-26",
    "Claude Haiku 4.5": "apps/api/evals/runs/claude-haiku-4-5-2026-06-26",
}

MODEL_COLORS = {
    "DeepSeek V3.2": "#9ecae1",
    "DeepSeek V4 Pro": "#bcbddc",
    "GPT 5.4 Mini": "#a1d99b",
    "Claude Haiku 4.5": "#fdd0a2",
}

VARIANT_ORDER = [
    "baseline",
    "cot-both",
    "cot-final",
    "cot-router",
    "few-shot-both",
    "few-shot-final",
    "few-shot-router",
    "rar-both",
    "rar-final",
    "rar-router",
    "tsb-both",
    "tsb-final",
    "tsb-router",
]

VARIANT_LABELS = {
    "baseline": "Baseline",
    "cot-both": "CoT Both",
    "cot-final": "CoT Final",
    "cot-router": "CoT Router",
    "few-shot-both": "Few-shot Both",
    "few-shot-final": "Few-shot Final",
    "few-shot-router": "Few-shot Router",
    "rar-both": "Rephrase Both",
    "rar-final": "Rephrase Final",
    "rar-router": "Rephrase Router",
    "tsb-both": "Step-back Both",
    "tsb-final": "Step-back Final",
    "tsb-router": "Step-back Router",
}

SCORE_METRICS = {
    "final_evaluation_score",
    "answer_similarity",
    "response_relevance_rr",
    "faithfulness_f",
    "operational_adherence",
    "evidence_coverage",
    "response_structure",
    "length_adequacy",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create pastel box plots for model and prompt-engineering evaluations."
    )
    parser.add_argument(
        "--run",
        action="append",
        default=[],
        metavar="LABEL=PATH",
        help=(
            "Run directory. Example: "
            '--run "GPT 5.4 Mini=apps/api/evals/runs/gpt-5-4-mini-2026-06-26"'
        ),
    )
    parser.add_argument(
        "--output-dir",
        default="apps/api/evals/plots/model-prompt-boxplots",
        help="Output directory for PNG and EPS files.",
    )
    parser.add_argument("--dpi", type=int, default=300)
    return parser.parse_args()


def parse_runs(raw_runs: list[str]) -> dict[str, Path]:
    if not raw_runs:
        return {label: Path(path) for label, path in DEFAULT_RUNS.items()}

    runs = {}
    for item in raw_runs:
        if "=" not in item:
            raise SystemExit(f"Invalid --run value: {item}. Use LABEL=PATH.")
        label, path = item.split("=", 1)
        runs[label.strip()] = Path(path.strip())

    return runs


def as_set(value: Any) -> set[str]:
    if not isinstance(value, list):
        return set()
    return {str(item) for item in value if item}


def f1_score(expected: set[str], actual: set[str]) -> float:
    if not expected and not actual:
        return 1.0
    if not expected or not actual:
        return 0.0

    overlap = len(expected & actual)
    if overlap == 0:
        return 0.0

    precision = overlap / len(actual)
    recall = overlap / len(expected)

    return 2 * precision * recall / (precision + recall)


def normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9à-ÿ]+", " ", text, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", text).strip()


def tokenize(text: str) -> list[str]:
    normalized = normalize_text(text)
    if not normalized:
        return []
    return normalized.split()


def token_f1(reference: str, response: str) -> float:
    reference_tokens = set(tokenize(reference))
    response_tokens = set(tokenize(response))
    return f1_score(reference_tokens, response_tokens)


def answer_similarity(reference: str, response: str) -> float:
    if not reference.strip() or not response.strip():
        return 0.0

    lexical = token_f1(reference, response)
    sequence = SequenceMatcher(None, normalize_text(reference), normalize_text(response)).ratio()

    return 100 * ((0.7 * lexical) + (0.3 * sequence))


def response_relevance_rr(question: str, reference: str, response: str) -> float:
    if not response.strip():
        return 0.0

    reference_alignment = answer_similarity(reference, response) if reference.strip() else 0.0
    question_alignment = answer_similarity(question, response) if question.strip() else 0.0

    if reference.strip() and question.strip():
        return (0.7 * reference_alignment) + (0.3 * question_alignment)

    return max(reference_alignment, question_alignment)


def stringify_evidence(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, list):
        return " ".join(stringify_evidence(item) for item in value)
    if isinstance(value, dict):
        return " ".join(stringify_evidence(item) for item in value.values())
    return str(value)


def collect_evidence_text(result: dict[str, Any]) -> str:
    orchestration = result.get("orchestration", {})
    evidence_parts: list[str] = []

    evidence_parts.extend(orchestration.get("retrievedContexts") or [])

    for source in orchestration.get("ragSources") or []:
        evidence_parts.append(stringify_evidence(source))

    for agent_result in orchestration.get("agentResults") or []:
        evidence_parts.append(stringify_evidence(agent_result.get("summary")))
        evidence_parts.append(stringify_evidence(agent_result.get("details")))
        evidence_parts.append(stringify_evidence(agent_result.get("agentResponseText")))
        evidence_parts.append(stringify_evidence(agent_result.get("evidence")))

    return " ".join(part for part in evidence_parts if part)


def faithfulness_f(result: dict[str, Any], response: str) -> float:
    evidence_text = collect_evidence_text(result)

    if not response.strip() or not evidence_text.strip():
        return 0.0

    response_tokens = set(tokenize(response))
    evidence_tokens = set(tokenize(evidence_text))

    if not response_tokens or not evidence_tokens:
        return 0.0

    supported_tokens = response_tokens & evidence_tokens
    precision_like_support = len(supported_tokens) / len(response_tokens)
    evidence_recall = len(supported_tokens) / len(evidence_tokens)

    lexical_support = f1_score(response_tokens, evidence_tokens)
    sequence_support = SequenceMatcher(
        None,
        normalize_text(response),
        normalize_text(evidence_text[:20000]),
    ).ratio()

    return 100 * (
        (0.55 * precision_like_support)
        + (0.25 * lexical_support)
        + (0.15 * sequence_support)
        + (0.05 * evidence_recall)
    )


def operational_adherence(result: dict[str, Any]) -> float:
    expected = result.get("input", {}).get("expected", {})
    orchestration = result.get("orchestration", {})

    route_expected = expected.get("route")
    route_actual = orchestration.get("route")

    parts = []

    if route_expected:
        parts.append(1.0 if route_actual == route_expected else 0.0)

    parts.append(
        f1_score(
            as_set(expected.get("agents")),
            as_set(orchestration.get("calledAgents")),
        )
    )

    parts.append(
        f1_score(
            as_set(expected.get("tools")),
            as_set(orchestration.get("calledTools")),
        )
    )

    return 100 * mean(parts)


def evidence_coverage(result: dict[str, Any]) -> float:
    orchestration = result.get("orchestration", {})
    retrieved_contexts = orchestration.get("retrievedContexts") or []
    rag_sources = orchestration.get("ragSources") or []
    called_agents = orchestration.get("calledAgents") or []
    called_tools = orchestration.get("calledTools") or []

    parts = [
        1.0 if retrieved_contexts else 0.0,
        min(len(rag_sources), 2) / 2,
        min(len(called_agents), 3) / 3,
        min(len(called_tools), 5) / 5,
    ]

    return 100 * mean(parts)


def response_structure(response: str) -> float:
    normalized = normalize_text(response)
    markers = [
        "resposta",
        "risco",
        "recomendação",
        "recomendacao",
        "dados coletados",
        "fonte dos dados",
        "motivo técnico",
        "motivo tecnico",
        "origem técnica",
        "origem tecnica",
    ]
    present = sum(1 for marker in markers if marker in normalized)

    return 100 * (present / len(markers))


def length_adequacy(reference: str, response: str) -> float:
    response_tokens = len(tokenize(response))
    reference_tokens = len(tokenize(reference))

    if response_tokens == 0:
        return 0.0

    if reference_tokens == 0:
        reference_tokens = 250

    ratio = response_tokens / reference_tokens

    if 0.75 <= ratio <= 2.25:
        return 100.0

    if ratio < 0.75:
        return max(0.0, 100 * (ratio / 0.75))

    return max(0.0, 100 * (2.25 / ratio))


def final_evaluation_score(metrics: dict[str, float]) -> float:
    return (
        0.30 * metrics["response_relevance_rr"]
        + 0.25 * metrics["faithfulness_f"]
        + 0.20 * metrics["operational_adherence"]
        + 0.10 * metrics["response_structure"]
        + 0.10 * metrics["length_adequacy"]
        + 0.05 * metrics["evidence_coverage"]
    )


def score_result(result: dict[str, Any]) -> dict[str, float]:
    question = str(result.get("input", {}).get("userInput") or "")
    reference = str(
        result.get("input", {}).get("reference")
        or result.get("input", {}).get("ragas", {}).get("groundTruth")
        or ""
    )
    response = str(result.get("response") or "")

    metrics = {
        "answer_similarity": answer_similarity(reference, response),
        "response_relevance_rr": response_relevance_rr(question, reference, response),
        "faithfulness_f": faithfulness_f(result, response),
        "operational_adherence": operational_adherence(result),
        "evidence_coverage": evidence_coverage(result),
        "response_structure": response_structure(response),
        "length_adequacy": length_adequacy(reference, response),
        "latency_seconds": float(result.get("durationMs") or 0) / 1000,
        "response_tokens": float(len(tokenize(response))),
    }
    metrics["final_evaluation_score"] = final_evaluation_score(metrics)

    return metrics


def load_rows(runs: dict[str, Path]) -> list[dict[str, Any]]:
    rows = []

    for model_label, run_dir in runs.items():
        results_path = run_dir / "results.jsonl"

        if not results_path.exists():
            print(f"Skipping missing run: {model_label} -> {results_path}")
            continue

        with results_path.open("r", encoding="utf-8-sig") as file:
            for line in file:
                if not line.strip():
                    continue

                result = json.loads(line)

                if result.get("status") != "success":
                    continue

                variant_id = result.get("variantId") or result.get("variant", {}).get("id")
                row = {
                    "model": model_label,
                    "variant": str(variant_id),
                }
                row.update(score_result(result))
                rows.append(row)

    if not rows:
        raise SystemExit("No successful evaluation rows were found.")

    return rows


def setup_style() -> None:
    plt.rcParams.update(
        {
            "figure.facecolor": "white",
            "axes.facecolor": "#fbfbfd",
            "axes.edgecolor": "#d9d9e3",
            "axes.labelcolor": "#222222",
            "axes.titleweight": "bold",
            "axes.titlesize": 13,
            "axes.labelsize": 10,
            "xtick.color": "#333333",
            "ytick.color": "#333333",
            "grid.color": "#e8e8ef",
            "grid.linewidth": 0.8,
            "legend.frameon": False,
            "font.family": "DejaVu Sans",
            "savefig.bbox": "tight",
        }
    )


def export(fig: plt.Figure, output_dir: Path, name: str, dpi: int) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_dir / f"{name}.png", dpi=dpi)
    fig.savefig(output_dir / f"{name}.eps", format="eps")
    plt.close(fig)


def draw_boxplot(
    ax: plt.Axes,
    data: list[list[float]],
    positions: list[float],
    colors: list[str],
    widths: float,
) -> None:
    box = ax.boxplot(
        data,
        positions=positions,
        patch_artist=True,
        showmeans=True,
        meanline=True,
        widths=widths,
        medianprops={"color": "#222222", "linewidth": 1.2},
        meanprops={"color": "#555555", "linewidth": 1.0, "linestyle": "--"},
        whiskerprops={"color": "#777777"},
        capprops={"color": "#777777"},
        flierprops={
            "marker": "o",
            "markersize": 3.0,
            "markerfacecolor": "#ffffff",
            "markeredgecolor": "#999999",
            "alpha": 0.75,
        },
    )

    for patch, color in zip(box["boxes"], colors):
        patch.set_facecolor(color)
        patch.set_edgecolor("#ffffff")
        patch.set_linewidth(1.0)


def plot_variant_boxplot_by_model(
    rows: list[dict[str, Any]],
    models: list[str],
    output_dir: Path,
    dpi: int,
    metric: str,
    ylabel: str,
    title: str,
    filename: str,
) -> None:
    fig, ax = plt.subplots(figsize=(16.5, 7.2))

    positions = []
    data = []
    colors = []
    tick_positions = []
    tick_labels = []

    group_gap = 0.55
    box_step = 0.22
    current = 1.0

    for variant in VARIANT_ORDER:
        variant_positions = []

        for model_index, model in enumerate(models):
            values = [
                row[metric]
                for row in rows
                if row["variant"] == variant and row["model"] == model
            ]

            pos = current + model_index * box_step
            positions.append(pos)
            variant_positions.append(pos)
            data.append(values)
            colors.append(MODEL_COLORS.get(model, "#c7d4e8"))

        tick_positions.append(mean(variant_positions))
        tick_labels.append(VARIANT_LABELS.get(variant, variant))
        current += len(models) * box_step + group_gap

    draw_boxplot(
        ax=ax,
        data=data,
        positions=positions,
        colors=colors,
        widths=0.18,
    )

    handles = [
        plt.Line2D(
            [0],
            [0],
            color=MODEL_COLORS.get(model, "#c7d4e8"),
            linewidth=8,
            label=model,
        )
        for model in models
    ]

    ax.legend(
        handles=handles,
        loc="upper center",
        ncols=min(4, len(models)),
        bbox_to_anchor=(0.5, 1.13),
    )

    ax.set_title(title)
    ax.set_xlabel("Prompt engineering variation")
    ax.set_ylabel(ylabel)
    ax.set_xticks(tick_positions, tick_labels)
    ax.grid(axis="y")

    if metric in SCORE_METRICS:
        ax.set_ylim(0, 105)

    plt.setp(ax.get_xticklabels(), rotation=35, ha="right")

    export(fig, output_dir, filename, dpi)


def plot_aggregated_model_boxplot(
    rows: list[dict[str, Any]],
    models: list[str],
    output_dir: Path,
    dpi: int,
    metric: str,
    ylabel: str,
    title: str,
    filename: str,
) -> None:
    data = [[row[metric] for row in rows if row["model"] == model] for model in models]

    positions = list(range(1, len(models) + 1))
    colors = [MODEL_COLORS.get(model, "#c7d4e8") for model in models]

    fig, ax = plt.subplots(figsize=(9.8, 5.8))

    draw_boxplot(
        ax=ax,
        data=data,
        positions=positions,
        colors=colors,
        widths=0.55,
    )

    ax.set_title(title)
    ax.set_xlabel("Model")
    ax.set_ylabel(ylabel)
    ax.set_xticks(positions, models)
    ax.grid(axis="y")

    if metric in SCORE_METRICS:
        ax.set_ylim(0, 105)

    plt.setp(ax.get_xticklabels(), rotation=15, ha="right")

    export(fig, output_dir, filename, dpi)


def print_summary(rows: list[dict[str, Any]], models: list[str]) -> None:
    print("\nSummary")
    print("-" * 96)

    for model in models:
        model_rows = [row for row in rows if row["model"] == model]
        if not model_rows:
            print(f"{model}: no rows found")
            continue

        print(
            f"{model}: "
            f"rows={len(model_rows)}, "
            f"final_score={mean(row['final_evaluation_score'] for row in model_rows):.2f}, "
            f"rr={mean(row['response_relevance_rr'] for row in model_rows):.2f}, "
            f"faithfulness={mean(row['faithfulness_f'] for row in model_rows):.2f}, "
            f"answer_similarity={mean(row['answer_similarity'] for row in model_rows):.2f}, "
            f"operational={mean(row['operational_adherence'] for row in model_rows):.2f}, "
            f"evidence={mean(row['evidence_coverage'] for row in model_rows):.2f}, "
            f"structure={mean(row['response_structure'] for row in model_rows):.2f}, "
            f"length={mean(row['length_adequacy'] for row in model_rows):.2f}, "
            f"latency={mean(row['latency_seconds'] for row in model_rows):.2f}s"
        )


def plot_metric_pair(
    rows: list[dict[str, Any]],
    models: list[str],
    output_dir: Path,
    dpi: int,
    metric: str,
    ylabel: str,
    readable_name: str,
    prefix: str,
) -> None:
    plot_variant_boxplot_by_model(
        rows=rows,
        models=models,
        output_dir=output_dir,
        dpi=dpi,
        metric=metric,
        ylabel=ylabel,
        title=f"{readable_name} Across Prompt Variations by Model",
        filename=f"{prefix}_{metric}_by_prompt_variation",
    )

    plot_aggregated_model_boxplot(
        rows=rows,
        models=models,
        output_dir=output_dir,
        dpi=dpi,
        metric=metric,
        ylabel=ylabel,
        title=f"Aggregated {readable_name} by Model",
        filename=f"{prefix}_{metric}_aggregated_by_model",
    )


def main() -> None:
    args = parse_args()
    runs = parse_runs(args.run)
    rows = load_rows(runs)
    models = list(runs.keys())
    output_dir = Path(args.output_dir)

    setup_style()

    plot_metric_pair(
        rows,
        models,
        output_dir,
        args.dpi,
        "final_evaluation_score",
        "Final evaluation score (%)",
        "Final Evaluation Score",
        "01",
    )
    plot_metric_pair(
        rows,
        models,
        output_dir,
        args.dpi,
        "response_relevance_rr",
        "Response relevance, RR (%)",
        "Response Relevance, RR",
        "02",
    )
    plot_metric_pair(
        rows,
        models,
        output_dir,
        args.dpi,
        "faithfulness_f",
        "Faithfulness, F (%)",
        "Faithfulness, F",
        "03",
    )
    plot_metric_pair(
        rows,
        models,
        output_dir,
        args.dpi,
        "answer_similarity",
        "Answer similarity (%)",
        "Answer Similarity",
        "04",
    )
    plot_metric_pair(
        rows,
        models,
        output_dir,
        args.dpi,
        "operational_adherence",
        "Operational adherence (%)",
        "Operational Adherence",
        "05",
    )
    plot_metric_pair(
        rows,
        models,
        output_dir,
        args.dpi,
        "evidence_coverage",
        "Evidence coverage (%)",
        "Evidence Coverage",
        "06",
    )
    plot_metric_pair(
        rows,
        models,
        output_dir,
        args.dpi,
        "response_structure",
        "Response structure (%)",
        "Response Structure",
        "07",
    )
    plot_metric_pair(
        rows,
        models,
        output_dir,
        args.dpi,
        "length_adequacy",
        "Length adequacy (%)",
        "Length Adequacy",
        "08",
    )
    plot_metric_pair(
        rows,
        models,
        output_dir,
        args.dpi,
        "response_tokens",
        "Response tokens",
        "Response Length",
        "09",
    )
    plot_metric_pair(
        rows,
        models,
        output_dir,
        args.dpi,
        "latency_seconds",
        "Latency (seconds)",
        "Latency",
        "10",
    )

    print_summary(rows, models)
    print(f"\nBox plots exported to: {output_dir.resolve()}")


if __name__ == "__main__":
    main()
