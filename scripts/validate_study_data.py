#!/usr/bin/env python3
"""公開前に既存220問とイントロ試作データの基本整合性を確認する。"""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_PATH = ROOT / "data" / "questions.json"
INTRO_PATH = ROOT / "data" / "intro_questions.json"


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def validate_main_questions(errors: list[str]) -> None:
    questions = load_json(QUESTIONS_PATH)
    require(len(questions) == 220, f"既存問題数が220ではありません: {len(questions)}", errors)
    ids = [str(question.get("id", "")).strip() for question in questions]
    require(all(ids), "IDが空の既存問題があります", errors)
    require(len(ids) == len(set(ids)), "既存問題に重複IDがあります", errors)

    for index, question in enumerate(questions, start=1):
        question_id = question.get("id", f"{index}行目")
        for key in ("id", "問題", "正解", "解説"):
            require(bool(str(question.get(key, "")).strip()), f"{question_id}: {key}が空です", errors)
        answer = str(question.get("正解", "")).strip()
        require(answer in {"A", "B", "C", "D"}, f"{question_id}: 正解がA〜Dではありません", errors)
        require(bool(str(question.get(f"選択肢{answer}", "")).strip()), f"{question_id}: 正解選択肢が空です", errors)


def validate_intro_questions(errors: list[str]) -> None:
    data = load_json(INTRO_PATH)
    questions = data.get("questions", [])
    require(data.get("collection", {}).get("totalOriginalQuestions") == 60, "イントロ原本総数が60ではありません", errors)
    require(len(questions) == 5, f"イントロ試作が5問ではありません: {len(questions)}", errors)
    ids = [str(question.get("id", "")).strip() for question in questions]
    require(all(ids), "IDが空のイントロ問題があります", errors)
    require(len(ids) == len(set(ids)), "イントロ問題に重複IDがあります", errors)

    supported_types = {"fill_match", "multiple_choice", "single_choice", "image_choice", "case_study"}
    supported_answers = {"mapping", "multiple", "single", "compound"}
    for question in questions:
        question_id = question.get("id", "ID不明")
        require(question.get("type") in supported_types, f"{question_id}: 未対応の問題形式です", errors)
        require(question.get("answer", {}).get("kind") in supported_answers, f"{question_id}: 未対応の正解形式です", errors)
        require(bool(str(question.get("prompt", "")).strip()), f"{question_id}: 問題文が空です", errors)
        require(question.get("source", {}).get("verified") is True, f"{question_id}: 原本照合済みではありません", errors)


def main() -> int:
    errors: list[str] = []
    validate_main_questions(errors)
    validate_intro_questions(errors)
    if errors:
        print("データ検証に失敗しました。", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("データ検証OK: 既存220問 / イントロ試作5問")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
