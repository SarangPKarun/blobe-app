terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "blobe"
      ManagedBy   = "terraform"
      Environment = "global"
      Repo        = "blobeNative"
    }
  }
}

provider "aws" {
  alias  = "eu_west_1"
  region = "eu-west-1"

  default_tags {
    tags = {
      Project     = "blobe"
      ManagedBy   = "terraform"
      Environment = "global"
      Repo        = "blobeNative"
    }
  }
}
