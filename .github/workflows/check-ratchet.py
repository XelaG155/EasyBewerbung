#!/usr/bin/env python3
"""Enforce the dated coverage and ESLint ratchet plans.

Reads ``ratchet.yml`` (the structured plan) and fails CI when:
- A milestone date has passed but the corresponding gate has not been
  raised in ``.github/workflows/test.yml``.
- A milestone date is more than 14 days overdue and no slip-update has
  been applied.

This converts "ratchet dates in a comment" (Iteration-5 testing audit
finding "plan is documented but not self-enforcing") into a real CI
gate with a clear failure mode and an obvious next step (either bump
the gate, or move the date and document the slip in quality_log.md).

Usage:
    python3 .github/workflows/check-ratchet.py
"""
from __future__ import annotations

import datetime
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

REPO = Path(__file__).resolve().parent.parent.parent
RATCHET = REPO / ".github" / "ratchet.yml"
WORKFLOW = REPO / ".github" / "workflows" / "test.yml"


def _parse_yaml(path: Path) -> dict:
    if yaml is None:
        # Tiny inline parser for the simple structure we use.
        out: dict = {}
        section = None
        for raw in path.read_text(encoding="utf-8").splitlines():
            if not raw.strip() or raw.lstrip().startswith("#"):
                continue
            if not raw.startswith(" "):
                section = raw.split(":", 1)[0].strip()
                out[section] = []
                continue
            stripped = raw.strip()
            if stripped.startswith("- "):
                # parse "- date: 2026-05-15, gate: 60, why: ..."
                rest = stripped[2:]
                entry: dict = {}
                for piece in rest.split(", "):
                    if ":" in piece:
                        k, v = piece.split(":", 1)
                        entry[k.strip()] = v.strip()
                out.setdefault(section, []).append(entry)
        return out
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _read_current_gate() -> tuple[int, int]:
    """Return (coverage_floor, lint_warning_ceiling) read from test.yml."""
    text = WORKFLOW.read_text(encoding="utf-8")
    cov_match = re.search(r"--cov-fail-under=(\d+)", text)
    lint_match = re.search(r"--max-warnings\s+(\d+)", text)
    if not cov_match or not lint_match:
        print("[check-ratchet] Could not parse current gates from test.yml", file=sys.stderr)
        sys.exit(2)
    return int(cov_match.group(1)), int(lint_match.group(1))


def _check(name: str, plan: list[dict], current: int, *, higher_is_stricter: bool) -> int:
    today = datetime.date.today()
    failures = 0
    for entry in plan:
        date_str = entry.get("date")
        gate = entry.get("gate")
        if not date_str or gate is None:
            continue
        milestone = datetime.date.fromisoformat(date_str)
        gate_int = int(gate)
        if today < milestone:
            continue
        # Milestone in the past: the current gate must have caught up.
        if higher_is_stricter:
            ok = current >= gate_int
        else:
            ok = current <= gate_int
        if not ok:
            days_overdue = (today - milestone).days
            print(
                f"[check-ratchet] {name} ratchet OVERDUE by {days_overdue} days: "
                f"milestone {date_str} requires {name}={gate_int} "
                f"(current={current}). "
                f"Either bump the gate in test.yml or move the date in "
                f"ratchet.yml and document the slip in quality_log.md.",
                file=sys.stderr,
            )
            failures += 1
    return failures


def main() -> int:
    if not RATCHET.exists():
        print(f"[check-ratchet] {RATCHET} not found — nothing to check.")
        return 0
    plan = _parse_yaml(RATCHET)
    coverage_floor, lint_ceiling = _read_current_gate()

    failures = 0
    failures += _check(
        "coverage",
        plan.get("coverage", []),
        coverage_floor,
        higher_is_stricter=True,
    )
    failures += _check(
        "lint-ceiling",
        plan.get("lint_ceiling", []),
        lint_ceiling,
        higher_is_stricter=False,
    )
    if failures:
        return 1
    print("[check-ratchet] All milestones on track.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
