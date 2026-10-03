#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
case "${1:-format}" in
  format) xcrun swift-format format --configuration .swift-format --in-place --recursive ios iosTests iosUITests ;;
  check) xcrun swift-format lint --configuration .swift-format --strict --recursive ios iosTests iosUITests ;;
  *) echo "Usage: $0 [format|check]" >&2; exit 2 ;;
esac
