resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, {
    Name                                                    = "blobe-${var.environment}"
    Environment                                             = var.environment
    "kubernetes.io/cluster/blobe-${var.environment}"        = "shared"
  })
}

# ── Subnets ────────────────────────────────────────────────────────────────────

resource "aws_subnet" "public" {
  count = length(var.azs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnets[count.index]
  availability_zone       = var.azs[count.index]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name                       = "blobe-${var.environment}-public-${var.azs[count.index]}"
    Environment                = var.environment
    Tier                       = "public"
    "kubernetes.io/role/elb"   = "1"
  })
}

resource "aws_subnet" "private" {
  count = length(var.azs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnets[count.index]
  availability_zone = var.azs[count.index]

  tags = merge(var.tags, {
    Name                                                    = "blobe-${var.environment}-private-${var.azs[count.index]}"
    Environment                                             = var.environment
    Tier                                                    = "private"
    "kubernetes.io/role/internal-elb"                       = "1"
    "kubernetes.io/cluster/blobe-${var.environment}"        = "owned"
  })
}

resource "aws_subnet" "data" {
  count = length(var.azs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.data_subnets[count.index]
  availability_zone = var.azs[count.index]

  tags = merge(var.tags, {
    Name        = "blobe-${var.environment}-data-${var.azs[count.index]}"
    Environment = var.environment
    Tier        = "data"
  })
}

# ── Internet Gateway ───────────────────────────────────────────────────────────

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name        = "blobe-${var.environment}-igw"
    Environment = var.environment
  })
}

# ── NAT Gateways (one per AZ) ─────────────────────────────────────────────────

resource "aws_eip" "nat" {
  count  = length(var.azs)
  domain = "vpc"

  tags = merge(var.tags, {
    Name        = "blobe-${var.environment}-nat-eip-${var.azs[count.index]}"
    Environment = var.environment
  })

  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "main" {
  count = length(var.azs)

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(var.tags, {
    Name        = "blobe-${var.environment}-nat-${var.azs[count.index]}"
    Environment = var.environment
  })

  depends_on = [aws_internet_gateway.main]
}

# ── Route Tables ──────────────────────────────────────────────────────────────

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(var.tags, {
    Name        = "blobe-${var.environment}-public-rt"
    Environment = var.environment
    Tier        = "public"
  })
}

resource "aws_route_table" "private" {
  count  = length(var.azs)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = merge(var.tags, {
    Name        = "blobe-${var.environment}-private-rt-${var.azs[count.index]}"
    Environment = var.environment
    Tier        = "private"
  })
}

# ── Route Table Associations ──────────────────────────────────────────────────

resource "aws_route_table_association" "public" {
  count = length(var.azs)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = length(var.azs)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_route_table_association" "data" {
  count = length(var.azs)

  subnet_id      = aws_subnet.data[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ── VPC Peering (cross-region, optional) ─────────────────────────────────────

resource "aws_vpc_peering_connection" "cross_region" {
  count = var.peer_vpc_id != "" ? 1 : 0

  vpc_id      = aws_vpc.main.id
  peer_vpc_id = var.peer_vpc_id
  peer_region = var.peer_region != "" ? var.peer_region : var.region
  auto_accept = false

  tags = merge(var.tags, {
    Name        = "blobe-${var.environment}-peering"
    Environment = var.environment
  })
}
