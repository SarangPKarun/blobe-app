terraform {
  backend "s3" {
    bucket         = "blobe-terraform-state-us-east-1"
    key            = "global/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "blobe-terraform-locks"
    encrypt        = true
  }
}
