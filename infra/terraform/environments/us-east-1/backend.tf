terraform {
  backend "s3" {
    bucket         = "blobe-terraform-state-us-east-1"
    key            = "environments/us-east-1/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "blobe-terraform-locks"
    encrypt        = true
    kms_key_id     = "alias/blobe-s3-production"
  }
}
