variable "environment" {
  description = "Deployment environment (e.g. prod, staging)"
  type        = string
}

variable "kms_key_arn" {
  description = "ARN of the KMS key used for S3 server-side encryption"
  type        = string
}

variable "is_primary_region" {
  description = "Whether this module is being deployed in the primary region"
  type        = bool
  default     = true
}

variable "dr_media_bucket_arn" {
  description = "ARN of the DR media bucket for replication"
  type        = string
  default     = ""
}

variable "dr_webview_bucket_arn" {
  description = "ARN of the DR webview bucket for replication"
  type        = string
  default     = ""
}

variable "dr_kms_s3_key_arn" {
  description = "ARN of the KMS key in the DR region used to encrypt replicated objects"
  type        = string
  default     = ""
}

variable "allowed_origins" {
  description = "List of allowed CORS origins for the media bucket"
  type        = list(string)
  default     = ["https://*.blobe.app", "blobe://*"]
}
