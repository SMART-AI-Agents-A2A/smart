from __future__ import annotations

import argparse
import json
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

PROMPT_FAMILY_ORDER = [
    "Baseline",
    "Chain-of-Thought",
    "Few-shot",
    "Rephrase-and-Respond",
    "Take-a-Step-Back",
]


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


def prompt_family(variant_id: str) -> str:
    if variant_id == "baseline":
        return "Baseline"
    if variant_id.startswith("cot-"):
        return "Chain-of-Thought"
    if variant_id.startswith("few-shot-"):
        return "Few-shot"
    if variant_id.startswith("rar-"):
        return "Rephrase-and-Respond"
    if variant_id.startswith("tsb-"):
        return "Take-a-Step-Back"
    return "Other"


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


def aggregate_score(result: dict[str, Any]) -> float:
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
                orchestration = result.get("orchestration", {})
                retrieved_contexts = orchestration.get("retrievedContexts") or []

                rows.append(
                    {
                        "model": model_label,
                        "variant": variant_id,
                        "prompt_family": prompt_family(str(variant_id)),
                        "aggregate_score": aggregate_score(result),
                        "latency_seconds": float(result.get("durationMs") or 0) / 1000,
                        "rag_coverage": 100.0 if retrieved_contexts else 0.0,
                    }
                )

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


def pastel_boxplot(
    ax: plt.Axes,
    data: list[list[float]],
    labels: list[str],
    colors: list[str],
) -> None:
    box = ax.boxplot(
        data,
        labels=labels,
        patch_artist=True,
        showmeans=True,
        meanline=True,
        widths=0.55,
        medianprops={"color": "#222222", "linewidth": 1.3},
        meanprops={"color": "#555555", "linewidth": 1.1, "linestyle": "--"},
        whiskerprops={"color": "#777777"},
        capprops={"color": "#777777"},
        flierprops={
            "marker": "o",
            "markersize": 3.5,
            "markerfacecolor": "#ffffff",
            "markeredgecolor": "#999999",
            "alpha": 0.75,
        },
    )

    for patch, color in zip(box["boxes"], colors):
        patch.set_facecolor(color)
        patch.set_edgecolor("#ffffff")
        patch.set_linewidth(1.0)


def plot_model_score_boxplot(
    rows: list[dict[str, Any]],
    models: list[str],
    output_dir: Path,
    dpi: int,
) -> None:
    data = [
        [row["aggregate_score"] for row in rows if row["model"] == model]
        for model in models
    ]

    fig, ax = plt.subplots(figsize=(9.4, 5.6))

    pastel_boxplot(
        ax,
        data,
        models,
        [MODEL_COLORS.get(model, "#c7d4e8") for model in models],
    )

    ax.set_title("Aggregate Performance Distribution by Model")
    ax.set_xlabel("Model")
    ax.set_ylabel("Aggregate score (%)")
    ax.set_ylim(0, 105)
    ax.grid(axis="y")
    plt.setp(ax.get_xticklabels(), rotation=15, ha="right")

    export(fig, output_dir, "01_model_score_boxplot", dpi)


def plot_prompt_family_boxplot(
    rows: list[dict[str, Any]],
    models: list[str],
    output_dir: Path,
    dpi: int,
) -> None:
    fig, ax = plt.subplots(figsize=(13.8, 6.6))

    positions = []
    data = []
    colors = []
    tick_positions = []
    tick_labels = []

    gap = 1.2
    width_step = 0.28
    current = 1.0

    for family in PROMPT_FAMILY_ORDER:
        family_positions = []

        for model_index, model in enumerate(models):
            values = [
                row["aggregate_score"]
                for row in rows
                if row["prompt_family"] == family and row["model"] == model
            ]

            pos = current + model_index * width_step
            positions.append(pos)
            family_positions.append(pos)
            data.append(values)
            colors.append(MODEL_COLORS.get(model, "#c7d4e8"))

        tick_positions.append(mean(family_positions))
        tick_labels.append(family)
        current += len(models) * width_step + gap

    box = ax.boxplot(
        data,
        positions=positions,
        patch_artist=True,
        showmeans=True,
        meanline=True,
        widths=0.22,
        medianprops={"color": "#222222", "linewidth": 1.2},
        meanprops={"color": "#555555", "linewidth": 1.0, "linestyle": "--"},
        whiskerprops={"color": "#777777"},
        capprops={"color": "#777777"},
        flierprops={
            "marker": "o",
            "markersize": 3.2,
            "markerfacecolor": "#ffffff",
            "markeredgecolor": "#999999",
            "alpha": 0.75,
        },
    )

    for patch, color in zip(box["boxes"], colors):
        patch.set_facecolor(color)
        patch.set_edgecolor("#ffffff")
        patch.set_linewidth(1.0)

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
        ncols=2,
        bbox_to_anchor=(0.5, 1.18),
    )

    ax.set_title("Performance Distribution by Prompt Engineering Family")
    ax.set_xlabel("Prompt engineering family")
    ax.set_ylabel("Aggregate score (%)")
    ax.set_xticks(tick_positions, tick_labels)
    ax.set_ylim(0, 105)
    ax.grid(axis="y")
    plt.setp(ax.get_xticklabels(), rotation=15, ha="right")

    export(fig, output_dir, "02_prompt_family_score_boxplot", dpi)


def plot_latency_boxplot(
    rows: list[dict[str, Any]],
    models: list[str],
    output_dir: Path,
    dpi: int,
) -> None:
    data = [
        [row["latency_seconds"] for row in rows if row["model"] == model]
        for model in models
    ]

    fig, ax = plt.subplots(figsize=(9.4, 5.6))

    pastel_boxplot(
        ax,
        data,
        models,
        [MODEL_COLORS.get(model, "#c7d4e8") for model in models],
    )

    ax.set_title("Latency Distribution by Model")
    ax.set_xlabel("Model")
    ax.set_ylabel("Latency (seconds)")
    ax.grid(axis="y")
    plt.setp(ax.get_xticklabels(), rotation=15, ha="right")

    export(fig, output_dir, "03_model_latency_boxplot", dpi)


def plot_rag_coverage_boxplot(
    rows: list[dict[str, Any]],
    models: list[str],
    output_dir: Path,
    dpi: int,
) -> None:
    data = [
        [row["rag_coverage"] for row in rows if row["model"] == model]
        for model in models
    ]

    fig, ax = plt.subplots(figsize=(9.4, 5.6))

    pastel_boxplot(
        ax,
        data,
        models,
        [MODEL_COLORS.get(model, "#c7d4e8") for model in models],
    )

    ax.set_title("RAG Coverage Distribution by Model")
    ax.set_xlabel("Model")
    ax.set_ylabel("RAG coverage (%)")
    ax.set_ylim(-5, 105)
    ax.grid(axis="y")
    plt.setp(ax.get_xticklabels(), rotation=15, ha="right")

    export(fig, output_dir, "04_model_rag_coverage_boxplot", dpi)


def print_summary(rows: list[dict[str, Any]], models: list[str]) -> None:
    print("\nSummary")
    print("-" * 72)

    for model in models:
        model_rows = [row for row in rows if row["model"] == model]
        if not model_rows:
            print(f"{model}: no rows found")
            continue

        avg_score = mean(row["aggregate_score"] for row in model_rows)
        avg_latency = mean(row["latency_seconds"] for row in model_rows)
        avg_rag = mean(row["rag_coverage"] for row in model_rows)

        print(
            f"{model}: "
            f"rows={len(model_rows)}, "
            f"avg_score={avg_score:.2f}, "
            f"avg_latency={avg_latency:.2f}s, "
            f"rag_coverage={avg_rag:.2f}%"
        )


def main() -> None:
    args = parse_args()
    runs = parse_runs(args.run)
    rows = load_rows(runs)
    models = list(runs.keys())
    output_dir = Path(args.output_dir)

    setup_style()

    plot_model_score_boxplot(rows, models, output_dir, args.dpi)
    plot_prompt_family_boxplot(rows, models, output_dir, args.dpi)
    plot_latency_boxplot(rows, models, output_dir, args.dpi)
    plot_rag_coverage_boxplot(rows, models, output_dir, args.dpi)

    print_summary(rows, models)
    print(f"\nBox plots exported to: {output_dir.resolve()}")


if __name__ == "__main__":
    main()
