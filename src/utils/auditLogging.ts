/* eslint-disable camelcase */
/* eslint-disable no-restricted-syntax */
import expressWinston from 'express-winston';
import winston, { Logform } from 'winston';

interface RequestMeta {
  req: {
    headers: {
      [key: string]: string | undefined;
      traceId?: string;
      authorization?: string;
      'user-agent'?: string;
    };
    method?: string;
    path?: string;
    query?: Record<string, unknown>;
    body?: unknown;
    ip?: string;
  };
  res: {
    statusCode?: number;
  };
}

interface UserInfo {
  sub: string;
  email: string;
  roles: string[];
}

interface Actor {
  ip: string;
  userAgent: string;
  type: string;
  email: string;
  id: string;
  sub: string;
  roles: string[];
}

interface NoActor {
  ip: string;
  userAgent: string;
}

interface AuditFieldConfig {
  queryParams?: string[];
  requestBody?: (string | { path: string; fields: string[] })[];
}

interface PathConfig {
  pattern: RegExp;
  config: AuditFieldConfig;
}

const PATH_CONFIGS: PathConfig[] = [
  {
    pattern: /^\/api\/participants\/\d+\/apiKey$/,
    config: {
      requestBody: ['name', 'roles'],
    },
  },
  {
    pattern: /^\/api\/participants\/\d+\/keyPair\/add$/,
    config: {
      requestBody: ['name'],
    },
  },
  {
    pattern: /^\/api\/participants\/\d+\/keyPair$/,
    config: {
      requestBody: [
        {
          path: 'keyPair',
          fields: ['subscriptionId', 'name', 'siteId'],
        },
      ],
    },
  },
  {
    pattern: /^\/api\/participants\/\d+\/sharingPermission\/shareWithTypes$/,
    config: {
      requestBody: ['types'],
    },
  },
];

const EMPTY_RECORD: Record<string, unknown> = {};

const getNestedValue = (obj: unknown, path: string[]): unknown => {
  let current: unknown = obj;
  for (const part of path) {
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
};

const setNestedValue = (obj: Record<string, unknown>, path: string[], value: unknown): void => {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const part = path[i];
    current[part] ??= {};
    current = current[part] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
};

const extractFieldsFromObject = (obj: unknown, fields: string[]): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    const fieldParts = field.split('.');
    const value = getNestedValue(obj, fieldParts);
    if (value !== undefined) {
      setNestedValue(result, fieldParts, value);
    }
  }

  return result;
};

export const extractConfiguredFields = (
  data: unknown,
  config?: AuditFieldConfig['requestBody'],
): Record<string, unknown> => {
  if (!config || !data || typeof data !== 'object') return {} as Record<string, unknown>;

  return config.reduce((acc, fieldConfig) => {
    if (typeof fieldConfig === 'string') {
      // Handle simple field paths
      const value = (data as Record<string, unknown>)[fieldConfig];
      if (value !== undefined) {
        acc[fieldConfig] = value;
      }
    } else {
      // Handle nested objects with field filtering
      const { path, fields } = fieldConfig;
      const pathParts = path.split('.');
      const targetObj = getNestedValue(data, pathParts);

      if (targetObj && typeof targetObj === 'object') {
        const filtered = extractFieldsFromObject(targetObj, fields);
        setNestedValue(acc, pathParts, filtered);
      }
    }
    return acc;
  }, {} as Record<string, unknown>);
};

const getAuditConfig = (path: string): AuditFieldConfig => {
  const matchingConfig = PATH_CONFIGS.find(({ pattern }) => pattern.test(path));
  return matchingConfig?.config ?? {};
};

const extractUserFromAuth = (authHeader?: string): UserInfo | null => {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.split(' ')[1];
    const base64Payload = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString()) as {
      sub: string;
      email: string;
      resource_access?: {
        self_serve_portal_apis?: {
          roles?: string[];
        };
      };
    };
    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.resource_access?.self_serve_portal_apis?.roles || [],
    };
  } catch (e) {
    return null;
  }
};

const extractActor = (userInfo: UserInfo | null, meta?: RequestMeta): Actor | NoActor => {
  if (userInfo) {
    return {
      ip: meta?.req?.ip ?? '',
      userAgent: meta?.req?.headers?.['user-agent'] ?? '',
      type: userInfo.email ? 'user' : meta?.req?.headers?.['user-agent'] ?? '',
      email: userInfo.email,
      id: userInfo.email,
      sub: userInfo.sub,
      roles: userInfo.roles,
    };
  }
  return {
    ip: meta?.req?.ip ?? '',
    userAgent: '',
  };
};

const toSnakeCase = (str: string): string => {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
};

export const convertToSnakeCase = (obj: Record<string, unknown>): Record<string, unknown> => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    acc[toSnakeCase(key)] = value;
    return acc;
  }, {} as Record<string, unknown>);
};

export const createAuditLogData = (
  timestamp: string,
  meta: RequestMeta | undefined,
  actor: Actor | NoActor,
) => {
  const path = meta?.req?.path ?? '';
  const config = getAuditConfig(path);
  const traceId = meta?.req?.headers?.['x-amzn-trace-id'] ?? meta?.req?.headers?.traceId ?? '';

  return {
    timestamp,
    logType: 'audit',
    source: 'uid2-tcportal',
    status: meta?.res?.statusCode ?? 0,
    method: meta?.req?.method ?? '',
    endpoint: path,
    traceId,
    uidTraceId: meta?.req?.headers?.['UID-Trace-Id'] ?? traceId,
    actor: JSON.stringify(convertToSnakeCase(actor as unknown as Record<string, unknown>)),
    queryParams: extractConfiguredFields(meta?.req?.query ?? EMPTY_RECORD, config.queryParams),
    requestBody: extractConfiguredFields(meta?.req?.body ?? EMPTY_RECORD, config.requestBody),
  };
};

export const auditTraceFormat = winston.format((info: Logform.TransformableInfo) => {
  const timestamp = info.timestamp as string;
  const meta = info.meta as RequestMeta | undefined;
  const userInfo = meta?.req?.headers?.authorization
    ? extractUserFromAuth(meta.req.headers.authorization)
    : null;
  const actor = extractActor(userInfo, meta);

  const logData = createAuditLogData(timestamp, meta, actor);
  return { ...info, message: JSON.stringify(convertToSnakeCase(logData)) };
})();

const auditLoggerFormat = () => {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    auditTraceFormat,
    winston.format.printf((info) => {
      const { message } = info as { message: string };
      return message;
    }),
  );
};

const getTransports = () => {
  return [new winston.transports.Console()];
};

const auditLogger = winston.createLogger({
  transports: getTransports(),
  format: auditLoggerFormat(),
});

export const getAuditLoggingMiddleware = () => expressWinston.logger({
  winstonInstance: auditLogger,
  expressFormat: true,
  meta: true,
  requestWhitelist: ['body', 'headers', 'query', 'method', 'path', 'ip'],
  responseWhitelist: ['statusCode'],
});
