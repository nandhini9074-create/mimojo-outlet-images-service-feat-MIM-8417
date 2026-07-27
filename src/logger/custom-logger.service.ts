import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

/** Serialize Error instances to plain objects and handle circular refs so meta is safe for JSON logs. */
function serializeMeta(meta: unknown, seen = new WeakSet<object>()): unknown {
  if (meta instanceof Error) {
    return {
      message: meta.message,
      name: meta.name,
      stack: meta.stack,
    };
  }
  if (meta !== null && typeof meta === 'object') {
    if (seen.has(meta as object)) {
      return '[Circular]';
    }
    seen.add(meta as object);
    if (Array.isArray(meta)) {
      return meta.map(item => serializeMeta(item, seen));
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(meta)) {
      out[k] = serializeMeta(v, seen);
    }
    return out;
  }
  return meta;
}

@Injectable()
export class CustomPinoLogger extends PinoLogger {
  info(msg: string, ...args: any[]): void;
  info(obj: object, msg?: string, ...args: any[]): void;
  info(messageOrObj: string | object, ...args: any[]): void {
    if (typeof messageOrObj === 'string' && args.length > 0) {
      const meta = serializeMeta(args[0]);
      super.info({ meta }, messageOrObj);
    } else {
      super.info(messageOrObj as any, ...args);
    }
  }

  error(msg: string, ...args: any[]): void;
  error(obj: object, msg?: string, ...args: any[]): void;
  error(messageOrObj: string | object, ...args: any[]): void {
    if (typeof messageOrObj === 'string' && args[0] instanceof Error) {
      super.error(args[0], messageOrObj);
      return;
    }
    if (typeof messageOrObj === 'string' && args.length > 0) {
      const meta = serializeMeta(args[0]);
      super.error({ meta }, messageOrObj);
    } else {
      super.error(messageOrObj as any, ...args);
    }
  }

  warn(msg: string, ...args: any[]): void;
  warn(obj: object, msg?: string, ...args: any[]): void;
  warn(messageOrObj: string | object, ...args: any[]): void {
    if (typeof messageOrObj === 'string' && args.length > 0) {
      const meta = serializeMeta(args[0]);
      super.warn({ meta }, messageOrObj);
    } else {
      super.warn(messageOrObj as any, ...args);
    }
  }

  debug(msg: string, ...args: any[]): void;
  debug(obj: object, msg?: string, ...args: any[]): void;
  debug(messageOrObj: string | object, ...args: any[]): void {
    if (typeof messageOrObj === 'string' && args.length > 0) {
      const meta = serializeMeta(args[0]);
      super.debug({ meta }, messageOrObj);
    } else {
      super.debug(messageOrObj as any, ...args);
    }
  }
}
