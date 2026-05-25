-- CreateExtension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create spatial index for Post location
-- Note: The table might not exist yet in this first migration if it's run first, 
-- but in Prisma usually the first migration contains the table creation.
-- Assuming table "Post" and column "location" will be created by Prisma schema:
-- CREATE INDEX "Post_location_idx" ON "Post" USING GIST ("location");
