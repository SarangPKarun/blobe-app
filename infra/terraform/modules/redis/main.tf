terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0"
    }
  }
}

# Redis auth token — special chars not allowed by ElastiCache
resource "random_password" "redis_auth" {
  length  = 32
  special = false
}

resource "aws_security_group" "redis" {
  name        = "blobe-${var.environment}-redis"
  description = "Allow Redis access from permitted CIDR blocks"
  vpc_id      = var.vpc_id

  ingress {
    description = "Redis"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "blobe-${var.environment}-redis"
    Environment = var.environment
  }
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "blobe-${var.environment}-redis"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "blobe-${var.environment}-redis"
    Environment = var.environment
  }
}

resource "aws_elasticache_parameter_group" "redis7" {
  name   = "blobe-${var.environment}-redis7"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  tags = {
    Name        = "blobe-${var.environment}-redis7"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "redis" {
  name              = "/blobe/${var.environment}/redis"
  retention_in_days = 30

  tags = {
    Name        = "blobe-${var.environment}-redis"
    Environment = var.environment
  }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id        = "blobe-${var.environment}"
  description                 = "Blobe Redis cluster for ${var.environment}"
  node_type                   = var.node_type
  num_node_groups             = var.num_node_groups
  replicas_per_node_group     = var.replicas_per_node_group
  automatic_failover_enabled  = true
  multi_az_enabled            = true
  engine_version              = "7.1"
  port                        = 6379
  parameter_group_name        = aws_elasticache_parameter_group.redis7.name
  subnet_group_name           = aws_elasticache_subnet_group.main.name
  security_group_ids          = [aws_security_group.redis.id]

  at_rest_encryption_enabled  = true
  kms_key_id                  = var.kms_key_arn
  transit_encryption_enabled  = true
  auth_token                  = random_password.redis_auth.result
  auth_token_update_strategy  = "ROTATE"

  snapshot_retention_limit    = 5
  snapshot_window             = "05:00-06:00"

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  tags = {
    Name        = "blobe-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_elasticache_global_replication_group" "main" {
  count = var.enable_global_datastore ? 1 : 0

  global_replication_group_id_suffix = var.global_datastore_suffix
  primary_replication_group_id       = aws_elasticache_replication_group.main.id
}
