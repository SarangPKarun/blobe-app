variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)"
  type        = string
}

variable "webview_bucket_regional_domain" {
  description = "Regional domain name of the S3 bucket serving the web/app assets"
  type        = string
}

variable "media_bucket_regional_domain" {
  description = "Regional domain name of the S3 bucket serving user-uploaded media"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate — must be provisioned in us-east-1 for CloudFront"
  type        = string
}

variable "domain_aliases" {
  description = "Alternate domain names (CNAMEs) for the CloudFront distribution"
  type        = list(string)
  default     = ["cdn.blobe.app", "globe.blobe.app"]
}

variable "access_logs_bucket" {
  description = "S3 bucket domain name for CloudFront access logs (must have logging grants)"
  type        = string
}

variable "price_class" {
  description = "CloudFront price class controlling which edge locations serve traffic"
  type        = string
  default     = "PriceClass_100"
}
