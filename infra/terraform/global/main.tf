# ---------------------------------------------------------------------------
# Route 53 — production hosted zone
# ---------------------------------------------------------------------------

resource "aws_route53_zone" "blobe" {
  name    = "blobe.app"
  comment = "Blobe production zone"

  tags = {
    Name = "blobe-production-zone"
  }
}

# ---------------------------------------------------------------------------
# ACM certificate — us-east-1 (required by CloudFront)
# ---------------------------------------------------------------------------

resource "aws_acm_certificate" "blobe_us" {
  provider = aws # us-east-1 — CloudFront requires certs in us-east-1

  domain_name               = "*.blobe.app"
  subject_alternative_names = ["blobe.app"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name   = "blobe-wildcard-us-east-1"
    Region = "us-east-1"
  }
}

# ---------------------------------------------------------------------------
# ACM certificate — eu-west-1 (for ALB in EU region)
# ---------------------------------------------------------------------------

resource "aws_acm_certificate" "blobe_eu" {
  provider = aws.eu_west_1

  domain_name               = "*.blobe.app"
  subject_alternative_names = ["blobe.app"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name   = "blobe-wildcard-eu-west-1"
    Region = "eu-west-1"
  }
}

# ---------------------------------------------------------------------------
# Route 53 DNS validation records for the us-east-1 certificate
# (Both certs share the same domain so one set of CNAME records suffices)
# ---------------------------------------------------------------------------

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.blobe_us.domain_validation_options :
    dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id = aws_route53_zone.blobe.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]

  allow_overwrite = true
}

# ---------------------------------------------------------------------------
# ACM certificate validation — us-east-1
# ---------------------------------------------------------------------------

resource "aws_acm_certificate_validation" "blobe_us" {
  provider        = aws # us-east-1
  certificate_arn = aws_acm_certificate.blobe_us.arn

  validation_record_fqdns = [
    for record in aws_route53_record.cert_validation : record.fqdn
  ]
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "route53_zone_id" {
  description = "Route 53 hosted zone ID for blobe.app"
  value       = aws_route53_zone.blobe.zone_id
}

output "route53_zone_name_servers" {
  description = "Name servers to register with the domain registrar"
  value       = aws_route53_zone.blobe.name_servers
}

output "acm_cert_arn_us" {
  description = "ACM certificate ARN in us-east-1 — attach to CloudFront distributions"
  value       = aws_acm_certificate_validation.blobe_us.certificate_arn
}

output "acm_cert_arn_eu" {
  description = "ACM certificate ARN in eu-west-1 — attach to EU ALB listeners"
  value       = aws_acm_certificate.blobe_eu.arn
}

output "sagemaker_execution_role_arn" {
  description = "IAM role ARN for SageMaker training jobs and endpoints"
  value       = aws_iam_role.sagemaker_execution.arn
}
