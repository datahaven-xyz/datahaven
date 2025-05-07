#!/usr/bin/env bash

set -euo pipefail

# Use first argument as file path, default to Cargo.toml
FILE="${1:-Cargo.toml}"
MODE="${2:-fix}" # "fix" (default) or "check"

# Check if file exists
if [[ ! -f "$FILE" ]]; then
    echo "Error: File '$FILE' not found"
    exit 1
fi

TMP_FILE="$(mktemp)"
SECTION_REGEX='^\[.*dependencies.*\]$'

process_file() {
    local in_section=0
    local section_content=""
    local current_group=""
    local current_comment=""

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Handle section headers
        if [[ "$line" =~ $SECTION_REGEX ]]; then
            if [[ -n "$section_content" ]]; then
                echo -n "$section_content" | LC_ALL=C sort -f
            fi
            in_section=1
            section_content=""
            current_group=""
            echo "$line"
            continue
        fi

        # Inside a dependencies section
        if [[ $in_section -eq 1 ]]; then
            # New section starts
            if [[ "$line" =~ ^\[[^]]+\] ]]; then
                if [[ -n "$section_content" ]]; then
                    echo -n "$section_content" | LC_ALL=C sort -f
                fi
                in_section=0
                section_content=""
                current_group=""
                echo "$line"
            # Empty line - flush current group
            elif [[ -z "$line" ]]; then
                if [[ -n "$section_content" ]]; then
                    echo -n "$section_content" | LC_ALL=C sort -f
                    echo
                fi
                section_content=""
                current_group=""
            # Comment line - start new group
            elif [[ "$line" =~ ^[[:space:]]*# ]]; then
                if [[ -n "$section_content" && "$current_group" != "$line" ]]; then
                    echo -n "$section_content" | LC_ALL=C sort -f
                    section_content=""
                fi
                current_group="$line"
                section_content="$line"$'\n'
            # Dependency line
            else
                if [[ -z "$current_group" ]]; then
                    current_group="default"
                fi
                section_content+="$line"$'\n'
            fi
        else
            echo "$line"
        fi
    done < "$FILE"

    if [[ -n "$section_content" ]]; then
        echo -n "$section_content" | LC_ALL=C sort -f
    fi
}

process_file > "$TMP_FILE"

if [[ "$MODE" == "check" ]]; then
    if ! diff -q "$TMP_FILE" "$FILE" > /dev/null; then
        echo "Error: $FILE is not sorted. Please run the script to sort it."
        diff "$FILE" "$TMP_FILE"
        rm "$TMP_FILE"
        exit 1
    else
        echo "Check passed: $FILE is properly sorted."
        rm "$TMP_FILE"
    fi
else
    mv "$TMP_FILE" "$FILE"
fi