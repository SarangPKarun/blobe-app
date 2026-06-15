locals {
  bucket_names = toset(["media", "webview", "ml"])
}

# ── Buckets ──────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "buckets" {
  for_each = local.bucket_names

  bucket        = "blobe-${var.environment}-${each.key}"
  force_destroy = false

  tags = {
    Environment = var.environment
    Purpose     = each.key
  }
}

# ── Versioning ────────────────────────────────────────────────────────────────

resource "aws_s3_bucket_versioning" "buckets" {
  for_each = local.bucket_names

  bucket = aws_s3_bucket.buckets[each.key].id

  versioning_configuration {
    status = "Enabled"
  }
}

# ── Server-side encryption ────────────────────────────────────────────────────

resource "aws_s3_bucket_server_side_encryption_configuration" "buckets" {
  for_each = local.bucket_names

  bucket = aws_s3_bucket.buckets[each.key].id

  rule {
    bucket_key_enabled = true

    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
  }
}

# ── Public access block ───────────────────────────────────────────────────────

resource "aws_s3_bucket_public_access_block" "buckets" {
  for_each = local.bucket_names

  bucket = aws_s3_bucket.buckets[each.key].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── CORS — media bucket only ──────────────────────────────────────────────────

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.buckets["media"].id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "GET"]
    allowed_origins = var.allowed_origins
    max_age_seconds = 3600
  }
}

# ── Lifecycle — ml bucket only ────────────────────────────────────────────────

resource "aws_s3_bucket_lifecycle_configuration" "ml" {
  bucket = aws_s3_bucket.buckets["ml"].id

  rule {
    id     = "intelligent-tiering-after-30-days"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "INTELLIGENT_TIERING"
    }
  }
}

# ── IAM replication role (primary region only) ────────────────────────────────

data "aws_iam_policy_document" "replication_assume_role" {
  count = var.is_primary_region ? 1 : 0

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["s3.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "replication_policy" {
  count = var.is_primary_region ? 1 : 0

  # Read replication configuration and list source buckets
  statement {
    sid    = "SourceBucketAccess"
    effect = "Allow"
    actions = [
      "s3:GetReplicationConfiguration",
      "s3:ListBucket",
    ]
    resources = [
      aws_s3_bucket.buckets["media"].arn,
      aws_s3_bucket.buckets["webview"].arn,
    ]
  }

  # Read source object versions
  statement {
    sid    = "SourceObjectVersionAccess"
    effect = "Allow"
    actions = [
      "s3:GetObjectVersionForReplication",
      "s3:GetObjectVersionAcl",
      "s3:GetObjectVersionTagging",
    ]
    resources = [
      "${aws_s3_bucket.buckets["media"].arn}/*",
      "${aws_s3_bucket.buckets["webview"].arn}/*",
    ]
  }

  # Write to destination (DR) buckets
  statement {
    sid    = "DestinationBucketAccess"
    effect = "Allow"
    actions = [
      "s3:ReplicateObject",
      "s3:ReplicateDelete",
      "s3:ReplicateTags",
    ]
    resources = [
      "${var.dr_media_bucket_arn}/*",
      "${var.dr_webview_bucket_arn}/*",
    ]
  }

  # Decrypt source objects with source KMS key
  statement {
    sid     = "DecryptSourceKMS"
    effect  = "Allow"
    actions = ["kms:Decrypt"]
    resources = [
      var.kms_key_arn,
    ]
  }

  # Encrypt replicated objects with DR KMS key
  statement {
    sid     = "EncryptDRKMS"
    effect  = "Allow"
    actions = ["kms:GenerateDataKey"]
    resources = [
      var.dr_kms_s3_key_arn,
    ]
  }
}

resource "aws_iam_role" "replication" {
  count = var.is_primary_region ? 1 : 0

  name               = "blobe-${var.environment}-s3-replication"
  assume_role_policy = data.aws_iam_policy_document.replication_assume_role[0].json

  inline_policy {
    name   = "s3-replication"
    policy = data.aws_iam_policy_document.replication_policy[0].json
  }

  tags = {
    Environment = var.environment
  }
}
