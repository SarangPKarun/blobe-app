variable "cluster_id" {
  description = "Unique identifier for the Redis cluster"
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)"
  type        = string
}

variable "node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.r7g.xlarge"
}

variable "num_node_groups" {
  description = "Number of node groups (shards) for cluster mode"
  type        = number
  default     = 3
}

variable "replicas_per_node_group" {
  description = "Number of replica nodes per shard"
  type        = number
  default     = 1
}

variable "subnet_ids" {
  description = "List of subnet IDs for the ElastiCache subnet group"
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID where the Redis cluster will be deployed"
  type        = string
}

variable "kms_key_arn" {
  description = "ARN of the KMS key for at-rest encryption"
  type        = string
}

variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to connect to Redis on port 6379"
  type        = list(string)
}

variable "enable_global_datastore" {
  description = "Whether to create an ElastiCache Global Datastore for cross-region replication"
  type        = bool
  default     = false
}

variable "global_datastore_suffix" {
  description = "Suffix for the Global Replication Group ID"
  type        = string
  default     = "blobe-global"
}
