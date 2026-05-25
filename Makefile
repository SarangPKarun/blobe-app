.PHONY: dev up down seed clean

# Database URL for Prisma migrations
export DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/blobe?schema=public

dev: up seed
	npm run dev

up:
	docker compose up -d --wait

down:
	docker compose down -v

seed:
	cd packages/database && npm install && npm run db:setup

clean: down
	rm -rf packages/database/node_modules
