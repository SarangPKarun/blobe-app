terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.0" }
    tls    = { source = "hashicorp/tls", version = "~> 4.0" }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "terraform"
      Project     = "blobe"
    }
  }
}

# Alias for EU replica target
provider "aws" {
  alias  = "eu_west_1"
  region = "eu-west-1"
  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "terraform"
      Project     = "blobe"
    }
  }
}

# Remote state data source for eu-west-1 outputs (used for cross-region refs)
data "terraform_remote_state" "eu_west_1" {
  backend = "s3"
  config = {
    bucket = "blobe-terraform-state-eu-west-1"
    key    = "environments/eu-west-1/terraform.tfstate"
    region = "eu-west-1"
  }
}
