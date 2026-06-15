terraform {
  backend "s3" {
    bucket         = "blobe-terraform-state-eu-west-1"
    key            = "environments/eu-west-1/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "blobe-terraform-locks-eu"
    encrypt        = true
  }
}
