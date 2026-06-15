# ── Media bucket replication ──────────────────────────────────────────────────

resource "aws_s3_bucket_replication_configuration" "media" {
  count = var.is_primary_region && var.dr_media_bucket_arn != "" ? 1 : 0

  bucket = aws_s3_bucket.buckets["media"].id
  role   = aws_iam_role.replication[0].arn

  depends_on = [aws_s3_bucket_versioning.buckets]

  rule {
    id     = "replicate-media-to-dr"
    status = "Enabled"

    source_selection_criteria {
      sse_kms_encrypted_objects {
        status = "Enabled"
      }
    }

    destination {
      bucket        = var.dr_media_bucket_arn
      storage_class = "STANDARD_IA"

      encryption_configuration {
        replica_kms_key_id = var.dr_kms_s3_key_arn
      }

      replication_time {
        status = "Enabled"
        time {
          minutes = 1
        }
      }

      metrics {
        status = "Enabled"
        event_threshold {
          minutes = 15
        }
      }
    }
  }
}

# ── Webview bucket replication ────────────────────────────────────────────────

resource "aws_s3_bucket_replication_configuration" "webview" {
  count = var.is_primary_region && var.dr_webview_bucket_arn != "" ? 1 : 0

  bucket = aws_s3_bucket.buckets["webview"].id
  role   = aws_iam_role.replication[0].arn

  depends_on = [aws_s3_bucket_versioning.buckets]

  rule {
    id     = "replicate-webview-to-dr"
    status = "Enabled"

    source_selection_criteria {
      sse_kms_encrypted_objects {
        status = "Enabled"
      }
    }

    destination {
      bucket        = var.dr_webview_bucket_arn
      storage_class = "STANDARD_IA"

      encryption_configuration {
        replica_kms_key_id = var.dr_kms_s3_key_arn
      }

      replication_time {
        status = "Enabled"
        time {
          minutes = 1
        }
      }

      metrics {
        status = "Enabled"
        event_threshold {
          minutes = 15
        }
      }
    }
  }
}
