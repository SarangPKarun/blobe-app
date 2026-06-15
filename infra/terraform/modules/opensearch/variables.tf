variable "domain_name" {
  description = "Name of the OpenSearch domain"
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)"
  type        = string
}

variable "engine_version" {
  description = "OpenSearch engine version"
  type        = string
  default     = "OpenSearch_2.11"
}

variable "data_instance_type" {
  description = "Instance type for data nodes"
  type        = string
  default     = "r6g.2xlarge.search"
}

variable "data_instance_count" {
  description = "Number of data nodes"
  type        = number
  default     = 3
}

variable "master_instance_type" {
  description = "Instance type for dedicated master nodes"
  type        = string
  default     = "r6g.large.search"
}

variable "ebs_volume_size" {
  description = "EBS volume size in GiB for each data node"
  type        = number
  default     = 200
}

variable "ebs_throughput" {
  description = "EBS throughput in MiB/s (gp3 only)"
  type        = number
  default     = 250
}

variable "subnet_ids" {
  description = "List of three subnet IDs, one per availability zone"
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID in which to deploy the OpenSearch domain"
  type        = string
}

variable "kms_key_arn" {
  description = "ARN of the KMS key used for encryption at rest"
  type        = string
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to reach the OpenSearch endpoint on port 443"
  type        = list(string)
}
