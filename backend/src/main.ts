import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Ensure root temp directory exists for media downloads and video rendering
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const app = await NestFactory.create(AppModule);

  // Bulletproof CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: '*',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`====================================================`);
  logger.log(`?? 1-Click Campaign Backend running at: http://localhost:${port}`);
  logger.log(`?? Static assets available at: http://localhost:${port}/temp/`);
  logger.log(`? API Endpoint: POST http://localhost:${port}/api/campaign/generate`);
  logger.log(`====================================================`);
}
await bootstrap();
