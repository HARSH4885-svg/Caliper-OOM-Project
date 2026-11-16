#!/usr/bin/env bash
# Builds the four isolated Linux runner images used by the Caliper judge.
# Prerequisites: Docker daemon running and network access to pull base images.
set -euo pipefail
cd "$(dirname "$0")/.."
build() { echo "==> $1"; docker build -q -t "$1" -f "sandbox/Dockerfiles/$2" sandbox/Dockerfiles; }
build codesentinel/runner-native:1 native.Dockerfile
build codesentinel/runner-java:1   java.Dockerfile
build codesentinel/runner-python:1 python.Dockerfile
build codesentinel/runner-node:1   node.Dockerfile
echo "Sandbox images ready:"; docker images --format '  {{.Repository}}:{{.Tag}}  {{.Size}}' | grep '^  codesentinel/runner' || true
