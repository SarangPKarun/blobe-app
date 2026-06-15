variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "production"
}

variable "region" {
  description = "AWS region for this deployment"
  type        = string
  default     = "eu-west-1"
}

variable "is_primary_region" {
  description = "Whether this is the primary (active) region. false = DR / standby region."
  type        = bool
  default     = false
}

# ──────────────────────────────────────────────────────────────
# VPC / Networking
# ──────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "CIDR block for the VPC (must not overlap with us-east-1: 10.0.0.0/16)"
  type        = string
  default     = "10.1.0.0/16"
}

variable "azs" {
  description = "Availability zones to use in eu-west-1"
  type        = list(string)
  default     = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
}

variable "public_subnets" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
}

variable "private_subnets" {
  description = "CIDR blocks for private (application) subnets (one per AZ)"
  type        = list(string)
  default     = ["10.1.11.0/24", "10.1.12.0/24", "10.1.13.0/24"]
}

variable "data_subnets" {
  description = "CIDR blocks for data-tier subnets (RDS / ElastiCache / MSK, one per AZ)"
  type        = list(string)
  default     = ["10.1.21.0/24", "10.1.22.0/24", "10.1.23.0/24"]
}

# ──────────────────────────────────────────────────────────────
# EKS
# ──────────────────────────────────────────────────────────────

variable "general_node_group_max" {
  description = "Maximum node count for the general-purpose node group. DR runs smaller than primary (default 8 vs 15 in us-east-1)."
  type        = number
  default     = 8
}

# ──────────────────────────────────────────────────────────────
# RDS (PostgreSQL)
# ──────────────────────────────────────────────────────────────

variable "rds_instance_class" {
  description = "Instance class for the RDS primary. Promote to db.r6g.2xlarge during DR failover."
  type        = string
  default     = "db.r6g.xlarge"
}

variable "rds_replica_instance_class" {
  description = "Instance class for in-region RDS read replicas"
  type        = string
  default     = "db.r6g.xlarge"
}

# ──────────────────────────────────────────────────────────────
# ElastiCache (Redis)
# ──────────────────────────────────────────────────────────────

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.r7g.large"
}

variable "redis_num_node_groups" {
  description = "Number of shards (node groups) for the Redis cluster"
  type        = number
  default     = 2
}

# ──────────────────────────────────────────────────────────────
# MSK (Kafka)
# ──────────────────────────────────────────────────────────────

variable "msk_broker_count" {
  description = "Number of MSK broker nodes (must be a multiple of the number of AZs)"
  type        = number
  default     = 3
}

variable "msk_broker_instance_type" {
  description = "EC2 instance type for MSK brokers"
  type        = string
  default     = "kafka.m5.large"
}

# ──────────────────────────────────────────────────────────────
# OpenSearch
# ──────────────────────────────────────────────────────────────

variable "opensearch_data_instance_type" {
  description = "Instance type for OpenSearch data nodes"
  type        = string
  default     = "r6g.xlarge.search"
}

variable "opensearch_data_instance_count" {
  description = "Number of OpenSearch data nodes"
  type        = number
  default     = 3
}
