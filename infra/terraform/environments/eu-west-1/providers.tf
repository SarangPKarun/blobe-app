terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Primary provider — eu-west-1 (DR region)
provider "aws" {
  region = "eu-west-1"

  default_tags {
    tags = {
      Project     = "blobe"
      Environment = var.environment
      ManagedBy   = "terraform"
      Region      = "eu-west-1"
    }
  }
}

# Alias provider for cross-region resource references (us-east-1 primary)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "blobe"
      Environment = var.environment
      ManagedBy   = "terraform"
      Region      = "us-east-1"
    }
  }
}

# Remote state from the us-east-1 primary region — used to pull resource ARNs
# (e.g. primary RDS ARN for cross-region replica source, S3 bucket ARNs for replication)
data "terraform_remote_state" "us_east_1" {
  backend = "s3"

  config = {
    bucket = "blobe-terraform-state-us-east-1"
    key    = "environments/us-east-1/terraform.tfstate"
    region = "us-east-1"
  }
}
