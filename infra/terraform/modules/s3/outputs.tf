# ── Media bucket ──────────────────────────────────────────────────────────────

output "media_bucket_id" {
  description = "Name (ID) of the media S3 bucket"
  value       = aws_s3_bucket.buckets["media"].id
}

output "media_bucket_arn" {
  description = "ARN of the media S3 bucket"
  value       = aws_s3_bucket.buckets["media"].arn
}

output "media_bucket_regional_domain" {
  description = "Regional domain name of the media S3 bucket"
  value       = aws_s3_bucket.buckets["media"].bucket_regional_domain_name
}

# ── Webview bucket ────────────────────────────────────────────────────────────

output "webview_bucket_id" {
  description = "Name (ID) of the webview S3 bucket"
  value       = aws_s3_bucket.buckets["webview"].id
}

output "webview_bucket_arn" {
  description = "ARN of the webview S3 bucket"
  value       = aws_s3_bucket.buckets["webview"].arn
}

output "webview_bucket_regional_domain" {
  description = "Regional domain name of the webview S3 bucket"
  value       = aws_s3_bucket.buckets["webview"].bucket_regional_domain_name
}

# ── ML bucket ─────────────────────────────────────────────────────────────────

output "ml_bucket_id" {
  description = "Name (ID) of the ML S3 bucket"
  value       = aws_s3_bucket.buckets["ml"].id
}

output "ml_bucket_arn" {
  description = "ARN of the ML S3 bucket"
  value       = aws_s3_bucket.buckets["ml"].arn
}
