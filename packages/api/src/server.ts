import "@tsed/swagger";
import "@tsed/socketio";
import "@tsed/platform-express";
import { join } from "node:path";
import process from "node:process";
import {
  Configuration,
  Inject,
  PlatformApplication,
  PlatformContext,
  Response,
  ResponseErrorObject,
} from "@tsed/common";
import { Catch, ExceptionFilterMethods } from "@tsed/platform-exceptions";
import type { Exception } from "@tsed/exceptions";
import { json } from "express";
import compress from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import { IsEnabled } from "middlewares/IsEnabled";
import { sendErrorReport } from "@snailycad/telemetry";
import { checkForUpdates } from "utils/checkForUpdates";
import { getCADVersion } from "@snailycad/utils/version";

const rootDir = __dirname;

@Configuration({
  rootDir,
  port: process.env.PORT_API ? parseInt(process.env.PORT_API) : 8080,
  logger: {
    debug: true,
    level: process.env.NODE_ENV === "production" ? "error" : "info",
  },
  mount: {
    "/v1": [`${rootDir}/controllers/**/*.ts`],
  },
  statics: {
    "/static": [
      {
        root: join(rootDir, "../", "public"),
        hook: "$beforeRoutesInit",
      },
    ],
  },
  middlewares: [
    cookieParser(),
    compress(),
    json({ limit: "500kb" }),
    cors({ origin: process.env.CORS_ORIGIN_URL ?? "http://localhost:3000", credentials: true }),
    IsEnabled,
  ],
  swagger: [{ path: "/api-docs", specVersion: "3.0.3" }],
  socketIO: {
    cors: {
      credentials: true,
      origin: process.env.CORS_ORIGIN_URL ?? "http://localhost:3000",
    },
  },
})
export class Server {
  @Inject()
  app!: PlatformApplication;

  @Configuration()
  settings!: Configuration;

  public $beforeRoutesInit() {
    if (process.env.EXPERIMENTAL_SECURE_CONTEXT) {
      const app = this.app.callback();
      app.set("trust proxy", 1);
    }

    this.app.get("/", async (_: any, res: Response) => {
      const versions = await getCADVersion();

      res.setHeader("content-type", "text/html");
      return res
        .status(200)
        .send(
          `<html><head><title>SnailyCAD API</title></head><body>200 Success. Current CAD Version: ${versions?.currentVersion} - ${versions?.currentCommitHash}</body></html>`,
        );
    });
  }

  public async $afterInit() {
    await checkForUpdates();
  }
}

@Catch(Error)
export class ErrorFilter implements ExceptionFilterMethods {
  catch(exception: Exception, ctx: PlatformContext) {
    const { response, logger } = ctx;
    const error = this.mapError(exception);
    const headers = this.getHeaders(exception);

    logger.error({
      error,
      catch: true,
    });

    sendErrorReport({
      name: error.name,
      message: error.message,
      stack: `${JSON.stringify(error.errors, null, 4)} \n\n\n ${JSON.stringify(error, null, 4)}`,
    });

    response
      .setHeaders(headers)
      .status(error.status || 500)
      .body(error);
  }

  mapError(error: any) {
    return {
      name: error.origin?.name || error.name,
      message: error.message,
      status: error.status || 500,
      errors: this.getErrors(error),
    };
  }

  protected getErrors(error: any) {
    return [error, error.origin].filter(Boolean).reduce((errs, { errors }: ResponseErrorObject) => {
      return [...errs, ...(errors || [])];
    }, []);
  }

  protected getHeaders(error: any) {
    return [error, error.origin].filter(Boolean).reduce((obj, { headers }: ResponseErrorObject) => {
      return {
        ...obj,
        ...(headers || {}),
      };
    }, {});
  }
}
