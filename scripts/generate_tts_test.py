#!/usr/bin/env python3
"""Study OSの短・中・長3問だけをOpenAI Speech APIで音声化する。"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_PATH = ROOT / "data" / "questions.json"
OUTPUT_DIR = ROOT / "audio" / "tts-test"
TEST_IDS = ("unko-1020", "unko-6015", "unko-5020")
MODEL = os.environ.get("OPENAI_TTS_MODEL", "tts-1-hd")
VOICE = os.environ.get("OPENAI_TTS_VOICE", "alloy")
API_URL = "https://api.openai.com/v1/audio/speech"


def load_questions() -> list[dict]:
    with QUESTIONS_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def correct_answer_text(question: dict) -> str:
    key = f"選択肢{question['正解']}"
    value = str(question.get(key, "")).strip()
    return value or str(question["正解"])


def build_segments(question: dict) -> tuple[str, str]:
    question_text = f"問題です。{question['問題']}"
    answer_parts = [
        f"正解は、{correct_answer_text(question)}です。",
        f"解説です。{question['解説']}",
    ]
    pitfall = str(question.get("間違えやすい理由", "")).strip()
    if pitfall:
        answer_parts.append(f"間違えやすいポイントです。{pitfall}")
    return question_text, " ".join(answer_parts)


def synthesize(api_key: str, text: str, output_path: Path) -> None:
    payload = json.dumps(
        {
            "model": MODEL,
            "voice": VOICE,
            "input": text,
            "response_format": "mp3",
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            output_path.write_bytes(response.read())
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Speech API error ({error.code}): {detail}") from error


def main() -> int:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("OPENAI_API_KEY が設定されていません。", file=sys.stderr)
        print("APIキーを環境変数へ設定してから再実行してください。", file=sys.stderr)
        return 2

    by_id = {q["id"]: q for q in load_questions()}
    missing = [question_id for question_id in TEST_IDS if question_id not in by_id]
    if missing:
        print(f"対象問題が見つかりません: {', '.join(missing)}", file=sys.stderr)
        return 3

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    entries = []
    total_chars = 0

    for label, question_id in zip(("短い", "標準", "長い"), TEST_IDS):
        question = by_id[question_id]
        question_script, answer_script = build_segments(question)
        total_chars += len(question_script) + len(answer_script)

        question_filename = f"{question_id}-question.mp3"
        answer_filename = f"{question_id}-answer.mp3"
        print(f"生成中: {label} / {question_id} / 問題")
        synthesize(api_key, question_script, OUTPUT_DIR / question_filename)
        print(f"生成中: {label} / {question_id} / 正解・解説")
        synthesize(api_key, answer_script, OUTPUT_DIR / answer_filename)

        entries.append(
            {
                "id": question_id,
                "lengthType": label,
                "field": question["分野"],
                "question": question["問題"],
                "questionScript": question_script,
                "answerScript": answer_script,
                "questionAudio": question_filename,
                "answerAudio": answer_filename,
                "characters": len(question_script) + len(answer_script),
            }
        )

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "model": MODEL,
        "voice": VOICE,
        "thinkingSeconds": 4,
        "totalCharacters": total_chars,
        "items": entries,
    }
    (OUTPUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"完了: {OUTPUT_DIR}")
    print(f"合計文字数: {total_chars}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
