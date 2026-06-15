variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "is_primary_region" {
  description = "Whether this is the primary region"
  type        = bool
  default     = true
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "azs" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "public_subnets" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnets" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

variable "data_subnets" {
  description = "CIDR blocks for data subnets"
  type        = list(string)
  default     = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]
}

variable "admin_cidrs" {
  description = "CIDR blocks allowed admin access — restrict in production"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "eks_cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.31"
}

variable "rds_instance_class" {
  description = "RDS primary instance class"
  type        = string
  default     = "db.r6g.2xlarge"
}

variable "rds_replica_instance_class" {
  description = "RDS read replica instance class"
  type        = string
  default     = "db.r6g.xlarge"
}

variable "rds_allocated_storage" {
  description = "RDS initial allocated storage in GB"
  type        = number
  default     = 200
}

variable "rds_max_allocated_storage" {
  description = "RDS maximum allocated storage in GB for autoscaling"
  type        = number
  default     = 1000
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.r7g.xlarge"
}

variable "redis_num_node_groups" {
  description = "Number of Redis node groups (shards)"
  type        = number
  default     = 3
}

variable "msk_broker_instance_type" {
  description = "MSK Kafka broker instance type"
  type        = string
  default     = "kafka.m5.large"
}

variable "msk_broker_count" {
  description = "Number of MSK Kafka broker nodes"
  type        = number
  default     = 3
}

variable "msk_ebs_volume_size" {
  description = "EBS volume size in GB per MSK broker"
  type        = number
  default     = 500
}

variable "opensearch_data_instance_type" {
  description = "OpenSearch data node instance type"
  type        = string
  default     = "r6g.2xlarge.search"
}

variable "opensearch_data_instance_count" {
  description = "Number of OpenSearch data nodes"
  type        = number
  default     = 3
}
