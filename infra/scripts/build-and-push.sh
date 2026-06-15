#!/bin/bash -e

VERSION=${1:-$(git rev-parse --short HEAD)}
REGION="us-east-1"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"

echo "Building and pushing images — version: ${VERSION}"
echo "Registry: ${REGISTRY}"

aws ecr get-login-password --region "${REGION}" | \
  docker login --username AWS --password-stdin "${REGISTRY}"

SERVICES=(
  "user-service"
  "post-service"
  "notification-service"
  "globe-service"
  "search-service"
  "trust-service"
  "moderation-service"
  "payment-service"
  "chat-service"
)

REPO_ROOT=$(git rev-parse --show-toplevel)

for SERVICE in "${SERVICES[@]}"; do
  IMAGE_TAG="${REGISTRY}/blobe/${SERVICE}:${VERSION}"
  SERVICE_DIR="${REPO_ROOT}/services/${SERVICE}"

  echo ""
  echo "--- Building ${SERVICE} ---"
  docker build -t "${IMAGE_TAG}" -f "${SERVICE_DIR}/Dockerfile" "${SERVICE_DIR}"

  echo "--- Pushing ${SERVICE} ---"
  docker push "${IMAGE_TAG}"

  echo "--- Done: ${IMAGE_TAG} ---"
done

echo ""
echo "All images built and pushed successfully."
