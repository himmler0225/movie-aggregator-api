import { INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { ROUTES_LOG_CONTEXT } from '../constants/http-log.constant';
import { AppLogger } from '../logger';

const METHOD_LABELS: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.OPTIONS]: 'OPTIONS',
  [RequestMethod.HEAD]: 'HEAD',
  [RequestMethod.ALL]: 'ALL',
};

interface RouteEntry {
  method: string;
  path: string;
}

export function logRegisteredRoutes(app: INestApplication): void {
  const logger = AppLogger.create(ROUTES_LOG_CONTEXT);
  const modulesContainer = app.get(ModulesContainer, { strict: false });
  const routes: RouteEntry[] = [];
  const seen = new Set<string>();
  for (const module of modulesContainer.values()) {
    for (const controller of module.controllers.values()) {
      if (!controller.metatype) continue;
      const controllerPath =
        (Reflect.getMetadata(PATH_METADATA, controller.metatype) as
          string | undefined) ?? '';
      collectHandlerRoutes(controller.metatype, controllerPath, routes, seen);
    }
  }
  routes.sort((a, b) =>
    a.path === b.path
      ? a.method.localeCompare(b.method)
      : a.path.localeCompare(b.path),
  );
  const lines = routes.map((r) => `  ${r.method.padEnd(6)} ${r.path}`);
  logger.log([`Registered ${routes.length} route(s):`, ...lines].join('\n'));
}

function collectHandlerRoutes(
  metatype: object,
  controllerPath: string,
  routes: RouteEntry[],
  seen: Set<string>,
): void {
  let proto = (
    metatype as {
      prototype?: object;
    }
  ).prototype;
  while (proto && proto !== Object.prototype) {
    for (const methodName of Object.getOwnPropertyNames(proto)) {
      if (methodName === 'constructor') continue;
      const handler = (proto as Record<string, unknown>)[methodName];
      if (typeof handler !== 'function') continue;
      const routePath = Reflect.getMetadata(PATH_METADATA, handler) as
        string | undefined;
      const requestMethod: unknown = Reflect.getMetadata(
        METHOD_METADATA,
        handler,
      );
      if (routePath === undefined || requestMethod === undefined) continue;
      const method = resolveMethodLabel(requestMethod);
      if (!method) continue;
      const path = joinRoutePath(controllerPath, routePath);
      const key = `${method}:${path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      routes.push({ method, path });
    }
    proto = Object.getPrototypeOf(proto) as object | undefined;
  }
}

function resolveMethodLabel(requestMethod: unknown): string | null {
  if (typeof requestMethod === 'number') {
    return METHOD_LABELS[requestMethod] ?? null;
  }
  if (typeof requestMethod === 'string') {
    return requestMethod.toUpperCase();
  }
  return null;
}

function joinRoutePath(controllerPath: string, routePath: string): string {
  const segments = [controllerPath, routePath]
    .flatMap((segment) => String(segment).split('/'))
    .filter(Boolean);
  return `/${segments.join('/')}`;
}
