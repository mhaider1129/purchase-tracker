#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:---plan}"

case "$MODE" in
    --plan|--publish) ;;
    *) echo "Use --plan or --publish"; exit 1 ;;
esac

cd "$(git rev-parse --show-toplevel)"

if [[ "$(git branch --show-current)" != "master" ]]; then
    echo "ERROR: Switch to master first"
    exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
    echo "ERROR: Working tree is not clean"
    exit 1
fi

git fetch origin master

SOURCE=$(git rev-parse HEAD)

if [[ "$SOURCE" != "$(git rev-parse origin/master)" ]]; then
    echo "ERROR: Local master differs from GitHub"
    exit 1
fi

declare -A URL OLD NEW TREE

URL[backend]="https://github.com/mhaider1129/purchase-backend.git"
URL[frontend]="https://github.com/mhaider1129/purchase-frontend.git"

for PART in backend frontend; do
    echo "=== Planning $PART ==="

    git fetch "${URL[$PART]}" main

    OLD[$PART]=$(git rev-parse FETCH_HEAD)
    TREE[$PART]=$(git rev-parse "$SOURCE:purchase-$PART")

    if git ls-tree -r --name-only "${TREE[$PART]}" |
        grep -Eq '(^|/)\.env$'; then
        echo "ERROR: Tracked .env file found"
        exit 1
    fi

    echo "Destination: ${OLD[$PART]}"
    echo "Source tree: ${TREE[$PART]}"

    git --no-pager diff --stat \
        "${OLD[$PART]}" "${TREE[$PART]}"

    if [[ "$(git rev-parse "${OLD[$PART]}^{tree}")" == "${TREE[$PART]}" ]]; then
        NEW[$PART]="${OLD[$PART]}"
        echo "Already synchronized"
    else
        NEW[$PART]=$(git commit-tree \
            "${TREE[$PART]}" \
            -p "${OLD[$PART]}" \
            -m "Synchronize $PART from combined $SOURCE")
    fi

    test "$(git rev-parse "${NEW[$PART]}^{tree}")" \
        = "${TREE[$PART]}"

    echo "Proposed commit: ${NEW[$PART]}"
done

if [[ "$MODE" == "--plan" ]]; then
    echo "PLAN COMPLETE: Nothing pushed"
    exit 0
fi

echo "Combined source: $SOURCE"
echo "Backend destination: ${OLD[backend]}"
echo "Frontend destination: ${OLD[frontend]}"

read -r -p "Confirm reviewed source replacement by typing PUBLISH: " CONFIRM

[[ "$CONFIRM" == "PUBLISH" ]] || exit 1

for PART in backend frontend; do
    git fetch "${URL[$PART]}" main

    if [[ "$(git rev-parse FETCH_HEAD)" != "${OLD[$PART]}" ]]; then
        echo "ERROR: Destination changed; replan"
        exit 1
    fi
done

for PART in backend frontend; do
    git push "${URL[$PART]}" \
        "${NEW[$PART]}:refs/heads/main"
done

for PART in backend frontend; do
    git fetch "${URL[$PART]}" main

    test "$(git rev-parse 'FETCH_HEAD^{tree}')" \
        = "${TREE[$PART]}"
done

echo "SUCCESS: Both repositories match combined master"
