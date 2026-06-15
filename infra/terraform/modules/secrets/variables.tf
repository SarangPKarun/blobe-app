variable "environment" {
  type = string
}

variable "kms_key_arn" {
  type = string
}

variable "rds_rotation_lambda_arn" {
  type    = string
  default = ""
}
