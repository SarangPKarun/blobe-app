output "key_arns" {
  description = "Map of key name to KMS key ARN"
  value       = { for k, v in aws_kms_key.keys : k => v.arn }
}

output "key_ids" {
  description = "Map of key name to KMS key ID"
  value       = { for k, v in aws_kms_key.keys : k => v.key_id }
}
