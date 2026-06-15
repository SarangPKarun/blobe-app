data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# ── Security Group ────────────────────────────────────────────────────────────

resource "aws_security_group" "opensearch" {
  name        = "blobe-${var.environment}-opensearch"
  description = "Allow HTTPS access to the OpenSearch domain"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from allowed CIDRs"
    from_port   = 443
    to_port     = 443
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
    Name        = "blobe-${var.environment}-opensearch"
    Environment = var.environment
  }
}

# ── IAM Role ──────────────────────────────────────────────────────────────────

resource "aws_iam_role" "opensearch_admin" {
  name = "blobe-${var.environment}-opensearch-admin"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "es.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name        = "blobe-${var.environment}-opensearch-admin"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "opensearch_admin_full_access" {
  role       = aws_iam_role.opensearch_admin.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonOpenSearchServiceFullAccess"
}

# ── CloudWatch Log Groups ─────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "opensearch_index_slow" {
  name              = "/blobe/${var.environment}/opensearch/index-slow"
  retention_in_days = 30

  tags = {
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "opensearch_search_slow" {
  name              = "/blobe/${var.environment}/opensearch/search-slow"
  retention_in_days = 30

  tags = {
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_resource_policy" "opensearch_logs" {
  policy_name = "blobe-${var.environment}-opensearch-logs"

  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "es.amazonaws.com"
        }
        Action = [
          "logs:PutLogEvents",
          "logs:CreateLogStream"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.opensearch_index_slow.arn}:*",
          "${aws_cloudwatch_log_group.opensearch_search_slow.arn}:*"
        ]
      }
    ]
  })
}

# ── OpenSearch Domain ─────────────────────────────────────────────────────────

resource "aws_opensearch_domain" "main" {
  domain_name    = "blobe-${var.environment}"
  engine_version = var.engine_version

  cluster_config {
    instance_type            = var.data_instance_type
    instance_count           = var.data_instance_count
    dedicated_master_enabled = true
    dedicated_master_type    = var.master_instance_type
    dedicated_master_count   = 3
    zone_awareness_enabled   = true

    zone_awareness_config {
      availability_zone_count = 3
    }
  }

  ebs_options {
    ebs_enabled = true
    volume_type = "gp3"
    volume_size = var.ebs_volume_size
    throughput  = var.ebs_throughput
    iops        = 3000
  }

  vpc_options {
    subnet_ids         = var.subnet_ids
    security_group_ids = [aws_security_group.opensearch.id]
  }

  encrypt_at_rest {
    enabled    = true
    kms_key_id = var.kms_key_arn
  }

  node_to_node_encryption {
    enabled = true
  }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }

  advanced_security_options {
    enabled                        = true
    anonymous_auth_enabled         = false
    internal_user_database_enabled = false

    master_user_options {
      master_user_arn = aws_iam_role.opensearch_admin.arn
    }
  }

  log_publishing_options {
    log_type                 = "INDEX_SLOW_LOGS"
    cloudwatch_log_group_arn = aws_cloudwatch_log_group.opensearch_index_slow.arn
    enabled                  = true
  }

  log_publishing_options {
    log_type                 = "SEARCH_SLOW_LOGS"
    cloudwatch_log_group_arn = aws_cloudwatch_log_group.opensearch_search_slow.arn
    enabled                  = true
  }

  snapshot_options {
    automated_snapshot_start_hour = 5
  }

  tags = {
    Name        = "blobe-${var.environment}"
    Environment = var.environment
  }

  depends_on = [
    aws_cloudwatch_log_resource_policy.opensearch_logs,
    aws_iam_role_policy_attachment.opensearch_admin_full_access,
  ]
}
