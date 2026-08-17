#!/bin/bash

set -euo pipefail

MIN_NODE_MAJOR=20
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

fail() {
  printf 'Testdocs Kit: %s\n' "$1" >&2
  exit 1
}

command_version() {
  "$1" --version 2>/dev/null || true
}

node_is_supported() {
  command -v node >/dev/null 2>&1 || return 1
  command -v npm >/dev/null 2>&1 || return 1

  local major
  major="$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf '0')"
  [[ "$major" =~ ^[0-9]+$ ]] && (( major >= MIN_NODE_MAJOR ))
}

load_homebrew() {
  if command -v brew >/dev/null 2>&1; then
    return 0
  fi

  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

install_node() {
  load_homebrew

  if ! command -v brew >/dev/null 2>&1; then
    command -v curl >/dev/null 2>&1 || fail "не найден curl, необходимый для установки Homebrew."
    [[ -t 0 ]] || fail "Node.js и Homebrew не установлены. Запустите setup-macos.sh в обычном интерактивном Terminal."

    printf 'Node.js/npm не найдены. Для их установки потребуется Homebrew.\n'
    printf 'Homebrew покажет план изменений и может запросить пароль macOS.\n'
    read -r -p 'Установить Homebrew и Node.js? [Y/n]: ' answer
    case "${answer:-Y}" in
      y|Y|yes|YES|Yes|д|Д|да|ДА|Да) ;;
      *) fail "установка отменена. Установите Node.js 20+ вручную и повторите команду." ;;
    esac

    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    load_homebrew
  fi

  command -v brew >/dev/null 2>&1 || fail "Homebrew установлен, но команда brew не найдена в PATH. Перезапустите Terminal и повторите запуск."

  if brew list --versions node >/dev/null 2>&1; then
    brew upgrade node || true
  else
    brew install node
  fi

  load_homebrew
  hash -r
  node_is_supported || fail "Node.js установлен, но node/npm 20+ не найдены в PATH. Перезапустите Terminal и повторите запуск."
}

show_check() {
  printf 'Git: %s\n' "$(command_version git)"
  printf 'Node.js: %s\n' "$(command_version node)"
  printf 'npm: %s\n' "$(command_version npm)"
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  fail "этот bootstrap предназначен для macOS. Для Linux или Windows используйте инструкцию в README.md."
fi

command -v git >/dev/null 2>&1 || fail "Git не установлен. Выполните 'xcode-select --install', завершите установку и повторите команду."

if [[ "${1:-}" == "--check" ]]; then
  show_check
  node_is_supported || fail "требуются Node.js ${MIN_NODE_MAJOR}+ и npm."
  printf 'Проверка bootstrap: OK\n'
  exit 0
fi

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  printf '%s\n' \
    'Использование: bash setup-macos.sh [параметры установщика]' \
    '' \
    'Скрипт проверяет Node.js/npm, при необходимости устанавливает их через Homebrew,' \
    'затем запускает npm run setup. Параметры передаются установщику Testdocs Kit.' \
    '' \
    'Проверить зависимости без установки: bash setup-macos.sh --check'
  exit 0
fi

if ! node_is_supported; then
  install_node
fi

cd "$PROJECT_DIR"
printf 'Используется Node.js %s и npm %s.\n' "$(node --version)" "$(npm --version)"
npm run setup -- "$@"
