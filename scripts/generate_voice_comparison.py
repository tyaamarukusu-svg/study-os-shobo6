#!/usr/bin/env python3
"""同じ1問を女性寄り・男性寄りの声で生成し、聞き比べ用に保存する。"""

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
OUTPUT_DIR = ROOT / "audio" / "voice-comparison"
QUESTION_ID = "unko-6015"
MODEL = os.environ.get("OPENAI_TTS_MODEL", "gpt-4o-mini-tts-2025-12-15")
API_URL = "https://api.openai.com/v1/audio/speech"
VOICES = (
    {"id": "marin", "label": "女性寄り（marin）"},
    {"id": "cedar", "label": "男性寄り（cedar）"},
)
INSTRUCTIONS = (
    "日本語で、明るく前向きな講師として話してください。"
    "元気はあるものの騒がしくせず、運転中でも聞き取りやすい明瞭な発音にしてください。"
    "問題文は落ち着いてはっきり読み、正解は少しテンションを上げ、"
    "解説は親しみやすく分かりやすく読んでください。"
)


def load_question() -> dict:
    questions = json.loads(QUESTIONS_PATH.read_text(encoding="utf-8"))
    return next(question for question in questions if question["id"] == QUESTION_ID)


def correct_answer_text(question: dict) -> str:
    return str(question.get(f"選択肢{question['正解']}", question["正解"]))


def build_segments(question: dict) -> tuple[str, str]:
    question_text = f"問題です。{question['問題']}"
    answer_parts = [
        f"正解は、{correct_answer_text(question)}です。",
        f"よくできました。解説です。{question['解説']}",
    ]
    pitfall = str(question.get("間違えやすい理由", "")).strip()
    if pitfall:
        answer_parts.append(f"ここがポイントです。{pitfall}")
    return question_text, " ".join(answer_parts)


def synthesize(api_key: str, text: str, voice: str, output_path: Path) -> None:
    payload = json.dumps(
        {
            "model": MODEL,
            "voice": voice,
            "input": text,
            "instructions": INSTRUCTIONS,
            "response_format": "mp3",
            "speed": 1.0,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            output_path.write_bytes(response.read())
    except urllib.error.HTTPError as error:
        # APIの詳細にはキー情報の一部が含まれる場合があるため、本文は表示しない。
        raise RuntimeError(f"Speech API error ({error.code})") from error


def main() -> int:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("OPENAI_API_KEY が設定されていません。", file=sys.stderr)
        return 2

    question = load_question()
    question_script, answer_script = build_segments(question)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    items = []

    for voice in VOICES:
        voice_id = voice["id"]
        question_file = f"{QUESTION_ID}-{voice_id}-question.mp3"
        answer_file = f"{QUESTION_ID}-{voice_id}-answer.mp3"
        print(f"生成中: {voice['label']} / 問題")
        synthesize(api_key, question_script, voice_id, OUTPUT_DIR / question_file)
        print(f"生成中: {voice['label']} / 正解・解説")
        synthesize(api_key, answer_script, voice_id, OUTPUT_DIR / answer_file)
        items.append(
            {
                "voice": voice_id,
                "label": voice["label"],
                "questionAudio": question_file,
                "answerAudio": answer_file,
            }
        )

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "model": MODEL,
        "questionId": QUESTION_ID,
        "question": question["問題"],
        "questionScript": question_script,
        "answerScript": answer_script,
        "countdownSeconds": 4,
        "instructions": INSTRUCTIONS,
        "items": items,
    }
    (OUTPUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"完了: {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
