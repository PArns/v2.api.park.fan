import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { Client, QueryResult } from 'pg';

async function createDatabaseIfNotExists(): Promise<void> {
	const logger = new Logger('DatabaseSetup');

	// Load environment variables manually
	const dbHost = process.env.DB_HOST || 'localhost';
	const dbPort = parseInt(process.env.DB_PORT || '5432');
	const dbUser = process.env.DB_USER || 'postgres';
	const dbPass = process.env.DB_PASS || 'postgres';
	const dbName = process.env.DB_NAME || 'api.park.fan';

	const client: Client = new Client({
		host: dbHost,
		port: dbPort,
		user: dbUser,
		password: dbPass,
		database: 'postgres', // Connect to default postgres database first
	});

	try {
		await client.connect();
		logger.log('Connected to PostgreSQL server');

		// Check if database exists
		const result: QueryResult = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
			dbName,
		]);

		if (result.rows.length === 0) {
			// Database doesn't exist, create it
			await client.query(`CREATE DATABASE "${dbName}"`);
			logger.log(`Database '${dbName}' created successfully`);
		} else {
			logger.log(`Database '${dbName}' already exists`);
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		logger.error(`Failed to create database: ${errorMessage}`);
		throw error;
	} finally {
		await client.end();
	}
}

async function bootstrap() {
	// Create database BEFORE starting the NestJS app
	await createDatabaseIfNotExists();

	const app = await NestFactory.create(AppModule);
	await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
