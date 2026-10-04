import './load-env';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AppConfigService } from './config';
import { setupSwagger, SWAGGER_PATH } from './config/swagger.config';
import { HttpLoggingInterceptor } from './shared/interceptors';
import { AppLogger } from './shared/logger';
import { logRegisteredRoutes } from './shared/utils/log-routes.util';

async function bootstrap() {
  const logger = AppLogger.create('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const appConfig = app.get(AppConfigService);
  // Behind nginx: req.ip becomes the client address nginx appends to X-Forwarded-For,
  // instead of the docker gateway (one shared rate-limit bucket for every user).
  app.set('trust proxy', appConfig.trustProxyHops);
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
