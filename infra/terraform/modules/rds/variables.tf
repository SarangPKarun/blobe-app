variable "identifier" {
  description = "The name of the RDS instance"
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)"
  type        = string
}

variable "instance_class" {
  description = "The instance class for the primary RDS instance"
  type        = string
  default     = "db.r6g.2xlarge"
}

variable "replica_instance_class" {
  description = "The instance class for read replica RDS instances"
  type        = string
  default     = "db.r6g.xlarge"
}

variable "allocated_storage" {
  description = "Initial allocated storage in GiB"
  type        = number
  default     = 200
}

variable "max_allocated_storage" {
  description = "Maximum storage autoscaling limit in GiB"
  type        = number
  default     = 1000
}

variable "subnet_ids" {
  description = "List of subnet IDs for the DB subnet group"
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID where the RDS instance will be deployed"
  type        = string
}

variable "kms_key_arn" {
  description = "ARN of the KMS key for storage encryption"
  type        = string
}

variable "db_name" {
  description = "Name of the initial database"
  type        = string
  default     = "blobe"
}

variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to connect to the RDS instance on port 5432"
  type        = list(string)
}

variable "backup_retention_period" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Daily time range during which automated backups are created (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Weekly time range during which system maintenance can occur (UTC)"
  type        = string
  default     = "Mon:04:00-Mon:05:00"
}

variable "create_cross_region_replica" {
  description = "Whether to create a cross-region read replica"
  type        = bool
  default     = false
}

variable "replica_region" {
  description = "AWS region for the cross-region replica (required when create_cross_region_replica = true)"
  type        = string
  default     = ""
}

variable "replica_kms_key_arn" {
  description = "ARN of the KMS key in the replica region for cross-region replica encryption"
  type        = string
  default     = ""
}
