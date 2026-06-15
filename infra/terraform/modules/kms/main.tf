locals {
  key_names = toset(["rds", "ebs", "msk", "elasticache", "s3", "secrets"])
}

resource "aws_kms_key" "keys" {
  for_each                = local.key_names
  description             = "Blobe ${each.key} encryption key - ${var.environment}"
  enable_key_rotation     = var.enable_key_rotation
  deletion_window_in_days = var.deletion_window
  tags = { Service = each.key, Environment = var.environment }
}

resource "aws_kms_alias" "aliases" {
  for_each      = aws_kms_key.keys
  name          = "alias/blobe-${each.key}-${var.environment}"
  target_key_id = each.value.key_id
}
