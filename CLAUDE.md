# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commonly Used Commands

- **Installation:** `npm install`
- **Development Server:** `npm run start:dev`
- **Build:** `npm run build`
- **Lint:** `npm run lint`
- **Format:** `npm run format`
- **Testing:**
    - `npm run test`: Run all unit tests.
    - `npm run test:watch`: Run tests in watch mode.
    - `npm run test:cov`: Generate a test coverage report.
    - `npm run test:e2e`: Run end-to-end tests.
- **Database:**
    - `npm run prisma:generate`: Generate the Prisma client.
    - `npm run prisma:migrate`: Run database migrations.
    - `npm run db:seed`: Seed the database with initial data.
    - `npm run prisma:studio`: Open the Prisma Studio GUI.

## High-Level Architecture

This is a NestJS application that serves as the backend for an automated Mini Program building service.

- **`src/main.ts`**: The application entry point.
- **`src/app.module.ts`**: The root module of the application.
- **`src/modules/`**: Contains the different business modules of the application.
    - **`auth/`**: Handles user authentication and authorization.
    - **`users/`**: Manages user-related operations.
    - **`miniprograms/`**: Manages Mini Program configurations.
    - **`build-tasks/`**: Handles the asynchronous build tasks, utilizing Bull for queueing.
    - **`websocket/`**: Manages real-time communication for build logs and progress via Socket.IO.
- **`prisma/`**: Contains the Prisma schema (`schema.prisma`) and seeding script (`seed.ts`).
