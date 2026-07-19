import './load-env';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './config';
import { setupSwagger, SWAGGER_PATH } from './config/swagger.config';
import { HttpLoggingInterceptor } from './shared/interceptors';
import { AppLogger } from './shared/logger';
import { logRegisteredRoutes } from './shared/utils/log-routes.util';

async function bootstrap() {
  const logger = AppLogger.create('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const appConfig = app.get(AppConfigService);

  app.enableCors({
    origin: appConfig.corsOriginOption,
  });

  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  setupSwagger(app);
  logRegisteredRoutes(app);

  const port = appConfig.port;
  await app.listen(port);

  logger.log(`API:  ${appConfig.apiPublicUrl}`);
  logger.log(`Docs: ${appConfig.apiPublicUrl}/${SWAGGER_PATH}`);
}

void bootstrap();
