import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MOVIES_API_PREFIX } from '../movies/sources/sources.registry';

export const SWAGGER_PATH = 'api/docs';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Movie Aggregator API')
    .setDescription(
      [
        'Gateway aggregating **KKPhim** (`phimapi.com`) and **OPhim** (`ophim1.com`).',
        '',
        `Single API prefix: \`/${MOVIES_API_PREFIX}/*\`.`,
        'Automatic fallback kkphim → ophim when upstream fails.',
        '',
        '**Unified response envelope:**',
        '```json',
        '{ "source": "kkphim", "data": {}, "pagination": {} }',
        '```',
        '- List: `data` = `MovieListItem[]`',
        '- Detail: `data` = `{ movie, episodes }`',
        '- Metadata: `data` = `{ _id, name, slug }[]`',
        '',
        'Use `?source=kkphim|ophim` to pin a source (disables fallback).',
      ].join('\n'),
    )
    .setVersion('2.0')
    .addTag('Health', 'Service health check')
    .addTag('Movies', 'Unified movie API with kkphim → ophim fallback')
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey}_${methodKey}`,
  });
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: `${SWAGGER_PATH}-json`,
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'list',
    },
  });
}
