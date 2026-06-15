###############################################################################
# Origin Access Control — used by both S3 origins
###############################################################################

resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "blobe-s3-oac-${var.environment}"
  description                       = "OAC for Blobe S3 origins (${var.environment})"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

###############################################################################
# Cache Policies
###############################################################################

resource "aws_cloudfront_cache_policy" "static_assets" {
  name        = "blobe-static-assets-${var.environment}"
  comment     = "Long-lived cache policy for static web assets"
  min_ttl     = 86400
  default_ttl = 2592000
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "none"
    }

    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

resource "aws_cloudfront_cache_policy" "media" {
  name        = "blobe-media-${var.environment}"
  comment     = "Medium-lived cache policy for user-uploaded media"
  min_ttl     = 3600
  default_ttl = 86400
  max_ttl     = 604800

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "none"
    }

    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

###############################################################################
# Response Headers Policy — security headers
###############################################################################

resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "blobe-security-headers-${var.environment}"
  comment = "Security response headers for Blobe CDN (${var.environment})"

  security_headers_config {
    content_security_policy {
      content_security_policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; worker-src blob:;"
      override                = true
    }

    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }
  }
}

###############################################################################
# CloudFront Distribution
###############################################################################

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  price_class         = var.price_class
  aliases             = var.domain_aliases
  default_root_object = "index.html"
  comment             = "Blobe CDN - ${var.environment}"

  # ---------------------------------------------------------------------------
  # Origins
  # ---------------------------------------------------------------------------

  origin {
    origin_id   = "s3-webview"
    domain_name = var.webview_bucket_regional_domain

    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  origin {
    origin_id   = "s3-media"
    domain_name = var.media_bucket_regional_domain

    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  # ---------------------------------------------------------------------------
  # Default cache behaviour — serves the SPA from the webview bucket
  # ---------------------------------------------------------------------------

  default_cache_behavior {
    target_origin_id       = "s3-webview"
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = aws_cloudfront_cache_policy.static_assets.id
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    compress               = true

    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  # ---------------------------------------------------------------------------
  # Ordered cache behaviour — /media/* served from the media bucket
  # ---------------------------------------------------------------------------

  ordered_cache_behavior {
    path_pattern           = "/media/*"
    target_origin_id       = "s3-media"
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = aws_cloudfront_cache_policy.media.id
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
  }

  # ---------------------------------------------------------------------------
  # Custom error responses — SPA client-side routing fallback
  # ---------------------------------------------------------------------------

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  # ---------------------------------------------------------------------------
  # Geo restrictions
  # ---------------------------------------------------------------------------

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # ---------------------------------------------------------------------------
  # TLS / viewer certificate
  # ---------------------------------------------------------------------------

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # ---------------------------------------------------------------------------
  # Access logging
  # ---------------------------------------------------------------------------

  logging_config {
    bucket = var.access_logs_bucket
    prefix = "cloudfront/${var.environment}/"
  }
}

###############################################################################
# S3 Bucket Policies — grant CloudFront OAC read access
###############################################################################

data "aws_iam_policy_document" "webview_oac" {
  statement {
    sid    = "AllowCloudFrontServicePrincipal"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["arn:aws:s3:::${replace(var.webview_bucket_regional_domain, "/\\.s3\\..*$/", "")}/*"]

    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudfront_distribution.main.arn]
    }
  }
}

data "aws_iam_policy_document" "media_oac" {
  statement {
    sid    = "AllowCloudFrontServicePrincipal"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["arn:aws:s3:::${replace(var.media_bucket_regional_domain, "/\\.s3\\..*$/", "")}/*"]

    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudfront_distribution.main.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "webview" {
  bucket = replace(var.webview_bucket_regional_domain, "/\\.s3\\..*$/", "")
  policy = data.aws_iam_policy_document.webview_oac.json
}

resource "aws_s3_bucket_policy" "media" {
  bucket = replace(var.media_bucket_regional_domain, "/\\.s3\\..*$/", "")
  policy = data.aws_iam_policy_document.media_oac.json
}
