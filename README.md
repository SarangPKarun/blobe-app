# Blobe Monorepo

Welcome to the Blobe project monorepo. This repository contains the mobile app, web apps, backend services, and shared packages, all managed within a single NPM workspace.

## Project Structure

This monorepo is organized into the following directories:

- `apps/` - Contains user-facing applications (e.g., `mobile`, `web-globe`, `admin`).
- `services/` - Contains backend microservices (e.g., `gateway`, `user-service`, `post-service`, `globe-service`, `notification-service`).
- `packages/` - Contains shared code, types, UI components, and utilities (e.g., `shared-types`, `ui`, `utils`, `configs`).
- `infra/` - Infrastructure as Code (IaC) and deployment configurations (e.g., Terraform, Kubernetes, Docker).
- `docs/` - General project documentation.

## Getting Started

### Prerequisites
- Node.js (v22+ recommended)
- NPM

### Installation
To install dependencies for all workspaces across the monorepo, run the following command from the root directory:

```bash
npm install
```

This will automatically configure the NPM workspaces, link all local packages, and hoist shared dependencies to the root `node_modules`.

## Running the Mobile App

The mobile application is located in `apps/mobile`.

1. Navigate to the mobile app directory:
   ```bash
   cd apps/mobile
   ```
2. Start the Metro Bundler:
   ```bash
   npm start
   ```
3. Run the app on an Android device or emulator:
   ```bash
   npm run android
   ```
4. Run the app on an iOS simulator:
   ```bash
   npm run ios
   ```

## Adding New Dependencies

When working in a monorepo, you can install a dependency for a specific workspace from the root directory using the `-w` (workspace) flag:

```bash
# Add a dependency to the mobile app
npm install lodash -w @blobe/mobile

# Add a dependency to a shared UI package
npm install react -w @blobe/ui
```
