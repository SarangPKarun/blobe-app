variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.31"
}

variable "vpc_id" {
  description = "VPC ID where the EKS cluster will be deployed"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for the EKS cluster"
  type        = list(string)
}

variable "kms_ebs_key_arn" {
  description = "ARN of the KMS key used to encrypt EBS volumes"
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. staging, production)"
  type        = string
}

variable "admin_cidrs" {
  description = "List of CIDRs allowed to access the EKS public endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "system_node_group" {
  description = "Configuration for the system node group (ON_DEMAND, for critical add-ons)"
  type = object({
    instance_type = string
    min_size      = number
    max_size      = number
    desired_size  = number
  })
  default = {
    instance_type = "m5.large"
    min_size      = 3
    max_size      = 3
    desired_size  = 3
  }
}

variable "general_node_group" {
  description = "Configuration for the general-purpose node groups (ON_DEMAND + SPOT)"
  type = object({
    instance_types       = list(string)
    min_size             = number
    max_size             = number
    desired_size         = number
    spot_instance_types  = list(string)
    spot_max_size        = number
  })
  default = {
    instance_types      = ["m5.xlarge", "m5.2xlarge"]
    min_size            = 2
    max_size            = 15
    desired_size        = 4
    spot_instance_types = ["m5.xlarge", "m5.2xlarge", "m4.xlarge"]
    spot_max_size       = 10
  }
}

variable "ml_node_group" {
  description = "Configuration for the ML workload node group"
  type = object({
    instance_types = list(string)
    min_size       = number
    max_size       = number
    desired_size   = number
  })
  default = {
    instance_types = ["m5.4xlarge", "c5.4xlarge"]
    min_size       = 0
    max_size       = 3
    desired_size   = 0
  }
}
