variable "environment" {
  description = "Deployment environment name (e.g. dev, staging, prod)"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
}

variable "azs" {
  description = "List of availability zones"
  type        = list(string)
}

variable "public_subnets" {
  description = "List of CIDR blocks for public subnets"
  type        = list(string)
}

variable "private_subnets" {
  description = "List of CIDR blocks for private subnets"
  type        = list(string)
}

variable "data_subnets" {
  description = "List of CIDR blocks for data subnets"
  type        = list(string)
}

variable "peer_vpc_id" {
  description = "VPC ID of the peer VPC for cross-region peering"
  type        = string
  default     = ""
}

variable "peer_vpc_cidr" {
  description = "CIDR block of the peer VPC"
  type        = string
  default     = ""
}

variable "peer_region" {
  description = "AWS region of the peer VPC"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
