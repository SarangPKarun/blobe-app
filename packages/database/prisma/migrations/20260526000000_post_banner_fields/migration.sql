-- AlterTable: add dual-side banner metadata fields to Post
ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS "frontText" TEXT,
  ADD COLUMN IF NOT EXISTS "backText"  TEXT,
  ADD COLUMN IF NOT EXISTS "mediaUrl"  TEXT;

-- AlterColumn: make content nullable (was required, now optional)
ALTER TABLE "Post" ALTER COLUMN "content" DROP NOT NULL;
