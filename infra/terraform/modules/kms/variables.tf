variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "deletion_window" {
  type    = number
  default = 30
}

variable "enable_key_rotation" {
  type    = bool
  default = true
}
