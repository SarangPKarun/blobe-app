import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Ensure a user exists to associate posts with
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'seeduser@example.com',
        phone: '+1234567890',
      },
    });
    console.log(`Created default user: ${user.id}`);
  } else {
    console.log(`Using existing user: ${user.id}`);
  }

  // Load locations from JSON
  const locationsPath = path.resolve(__dirname, '../../../apps/mobile/android/app/src/main/assets/location/locations.json');
  if (!fs.existsSync(locationsPath)) {
    console.error(`Locations file not found at ${locationsPath}`);
    process.exit(1);
  }

  const locationsData = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));
  const locations = locationsData.locations;

  console.log(`Loaded ${locations.length} locations. Inserting posts...`);

  // Insert posts for each location
  for (const loc of locations) {
    // Generate UUIDs for id
    const postId = crypto.randomUUID();

    // The ST_MakePoint takes (longitude, latitude)
    // We use $executeRaw to handle the PostGIS geometry insertion
    await prisma.$executeRaw`
      INSERT INTO "Post" (id, "createdAt", "updatedAt", title, content, "authorId", location)
      VALUES (
        ${postId}::text, 
        NOW(), 
        NOW(), 
        ${`Post from ${loc.name}`}, 
        ${`This is a sample post located in ${loc.name}.`}, 
        ${user.id}, 
        ST_SetSRID(ST_MakePoint(${loc.lng}, ${loc.lat}), 4326)
      )
    `;
    console.log(`Inserted post for ${loc.name} at [${loc.lat}, ${loc.lng}]`);
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
