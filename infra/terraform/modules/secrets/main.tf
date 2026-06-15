locals {
  secrets_map = {
    "blobe/${var.environment}/rds/master-password"                      = "RDS master password"
    "blobe/${var.environment}/rds/url"                                  = "Full PostgreSQL connection URL"
    "blobe/${var.environment}/redis/auth-token"                         = "ElastiCache AUTH token"
    "blobe/${var.environment}/kafka/sasl-credentials"                   = "MSK SASL credentials"
    "blobe/${var.environment}/shared/jwt-secret"                        = "HS256 JWT signing secret (all services)"
    "blobe/${var.environment}/globe-service/sagemaker-endpoint"         = "SageMaker banner-rank endpoint URL"
    "blobe/${var.environment}/notification-service/sendgrid-api-key"    = "SendGrid API key"
    "blobe/${var.environment}/notification-service/firebase-credentials" = "Firebase service account JSON"
    "blobe/${var.environment}/moderation-service/openai-api-key"        = "OpenAI API key"
    "blobe/${var.environment}/payment-service/stripe-secret-key"        = "Stripe secret key"
    "blobe/${var.environment}/payment-service/stripe-webhook-secret"    = "Stripe webhook signing secret"
    "blobe/${var.environment}/ml-pipeline/airflow-fernet-key"           = "Airflow Fernet encryption key"
    "blobe/${var.environment}/ml-pipeline/airflow-webserver-secret-key" = "Airflow webserver secret key"
    "blobe/${var.environment}/ml-pipeline/sagemaker-role-arn"           = "SageMaker execution role ARN"
  }
}

resource "aws_secretsmanager_secret" "secrets" {
  for_each = local.secrets_map

  name                    = each.key
  description             = each.value
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret_rotation" "rds_password" {
  count = var.rds_rotation_lambda_arn != "" ? 1 : 0

  secret_id           = aws_secretsmanager_secret.secrets["blobe/${var.environment}/rds/master-password"].id
  rotation_lambda_arn = var.rds_rotation_lambda_arn

  rotation_rules {
    automatically_after_days = 30
  }
}
