variable "cluster_name" {
  description = "Name of the MSK cluster"
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)"
  type        = string
}

variable "kafka_version" {
  description = "Apache Kafka version for the MSK cluster"
  type        = string
  default     = "3.5.1"
}

variable "number_of_broker_nodes" {
  description = "Number of broker nodes in the MSK cluster"
  type        = number
  default     = 3
}

variable "broker_instance_type" {
  description = "EC2 instance type for the MSK broker nodes"
  type        = string
  default     = "kafka.m5.large"
}

variable "broker_ebs_volume_size" {
  description = "EBS volume size in GiB for each broker node"
  type        = number
  default     = 500
}

variable "subnet_ids" {
  description = "List of subnet IDs (one per AZ) for broker node placement"
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID where the MSK cluster will be deployed"
  type        = string
}

variable "kms_key_arn" {
  description = "ARN of the KMS key for MSK encryption at rest"
  type        = string
}

variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to connect to the MSK cluster"
  type        = list(string)
}

variable "dr_msk_bootstrap_brokers" {
  description = "Bootstrap brokers string for the DR MSK cluster (used by MirrorMaker2 as target)"
  type        = string
  default     = ""
}

variable "is_primary_region" {
  description = "Whether this deployment is in the primary region (controls MirrorMaker2 creation)"
  type        = bool
  default     = true
}
