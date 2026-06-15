locals {
  service_images = toset([
    "blobe/user-service",
    "blobe/post-service",
    "blobe/notification-service",
    "blobe/globe-service",
    "blobe/search-service",
    "blobe/trust-service",
    "blobe/moderation-service",
    "blobe/payment-service",
    "blobe/chat-service",
    "blobe/ml-pipeline",
  ])
}

resource "aws_ecr_repository" "services" {
  for_each             = local.service_images
  name                 = each.key
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
  }
}

resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = aws_ecr_repository.services
  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

output "ecr_repository_urls" {
  value = { for k, v in aws_ecr_repository.services : k => v.repository_url }
}
