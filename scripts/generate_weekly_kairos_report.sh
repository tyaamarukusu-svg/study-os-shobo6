#!/bin/zsh
set -eu

script_dir="${0:A:h}"
repo_dir="${script_dir:h}"
output_dir="$repo_dir/reports/kairos-weekly"
mkdir -p "$output_dir"

generated_at="$(date '+%Y-%m-%d %H:%M:%S %z')"
report_date="$(date '+%Y-%m-%d')"
since_date="$(date -v-7d '+%Y-%m-%d 00:00:00')"
report_file="$output_dir/${report_date}_study-os_git週次レポート.md"

cd "$repo_dir"

commit_ids=("${(@f)$(git log --since="$since_date" --reverse --format='%H')}")
if [[ ${#commit_ids[@]} -eq 1 && -z "${commit_ids[1]}" ]]; then
  commit_ids=()
fi

{
  print '# Study OS Git週次レポート'
  print
  print -r -- "- 生成日時: $generated_at"
  print -r -- "- 対象期間: $since_date 以降"
  print -r -- "- ブランチ: $(git branch --show-current)"
  print -r -- "- 最新コミット: $(git rev-parse --short HEAD)"
  print -r -- "- 対象コミット数: ${#commit_ids[@]}"
  print
  print '## 概要'
  print
  if (( ${#commit_ids[@]} == 0 )); then
    print '対象期間内のコミットはありません。'
  else
    git log --since="$since_date" --reverse --format='- %ad `%h` %s' --date='format:%Y-%m-%d %H:%M'
  fi
  print
  print '## 変更詳細'
  print

  for commit_id in "${commit_ids[@]}"; do
    subject="$(git log -1 --format='%s' "$commit_id")"
    body="$(git log -1 --format='%b' "$commit_id")"
    print -r -- "### $(git rev-parse --short "$commit_id") $subject"
    print
    print -r -- "- 日時: $(git log -1 --format='%ad' --date='format:%Y-%m-%d %H:%M:%S' "$commit_id")"
    print -r -- '- 変更ファイル:'
    git diff-tree --root --no-commit-id --name-status -r "$commit_id" | sed 's/^/  - /'
    print -r -- '- 変更量:'
    git show --shortstat --format='' "$commit_id" | sed 's/^/  - /'
    print

    for label in 問題 変更前 判断理由 変更内容 変更後 確認結果 未解決; do
      value="$(print -r -- "$body" | sed -n "s/^${label}：[[:space:]]*//p" | head -1)"
      [[ -n "$value" ]] || value='不明（コミット履歴に記録なし）'
      print -r -- "- ${label}: ${value}"
    done
    print
  done

  print '## セキュリティ確認'
  print
  sensitive_files="$(git ls-files | grep -Ei '(^|/)(\.env|id_rsa|id_ed25519|credentials|secrets?|tokens?|.*\.pem|.*\.p12|.*\.key)$' || true)"
  if [[ -z "$sensitive_files" ]]; then
    print -r -- '- 秘密情報を示す代表的なファイル名: 検出なし'
  else
    print -r -- '- 要確認: 秘密情報を示す可能性のあるファイル名を検出（値は出力しません）'
    print -r -- "$sensitive_files" | sed 's/^/  - /'
  fi
  print
  print '## KAIROSレビュー欄'
  print
  print -r -- '- 正式Knowledge候補:'
  print -r -- '- Rules候補:'
  print -r -- '- Project反映候補:'
  print -r -- '- 保留・追加確認:'
  print
  print '> このレポートは自動生成されたレビュー素材です。人間の確認前に正式KnowledgeやRulesへ昇格させないでください。'
} > "$report_file"

print "$report_file"
