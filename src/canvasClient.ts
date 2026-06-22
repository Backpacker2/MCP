import axios, { AxiosInstance, AxiosError } from "axios";
import { CanvasApiError, statusCodeToMessage } from "./errors.js";

export interface CanvasClientOptions {
  baseUrl: string;
  accessToken: string;
}

const MAX_RETRY_ATTEMPTS = 3;

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = MAX_RETRY_ATTEMPTS): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (
        err instanceof CanvasApiError &&
        err.statusCode === 429 &&
        attempt < maxAttempts
      ) {
        const delayMs = 1000 * 2 ** (attempt - 1);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw new CanvasApiError(429, statusCodeToMessage(429));
}

function toCanvasError(error: unknown): CanvasApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const retryAfter = axiosError.response?.headers?.["retry-after"];
    const status = axiosError.response?.status ?? 0;
    const err = new CanvasApiError(status, statusCodeToMessage(status));
    if (retryAfter) (err as CanvasApiError & { retryAfter: string }).retryAfter = retryAfter;
    return err;
  }
  return new CanvasApiError(0, "Onbekende fout bij aanroep van Canvas API.");
}

export class CanvasClient {
  private http: AxiosInstance;
  private cache = new Map<string, unknown>();
  readonly baseUrl: string;

  constructor({ baseUrl, accessToken }: CanvasClientOptions) {
    this.baseUrl = baseUrl;
    this.http = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      timeout: 15000,
    });

    // Log requests voor debugging — headers worden bewust weggelaten om token te beschermen
    this.http.interceptors.request.use((config) => {
      process.stderr.write(`[Canvas] ${config.method?.toUpperCase()} ${config.url}\n`);
      return config;
    });
  }

  cacheGet<T>(key: string): T | undefined {
    return this.cache.get(key) as T | undefined;
  }

  cacheSet(key: string, value: unknown): void {
    this.cache.set(key, value);
  }

  async get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
    return withRetry(async () => {
      try {
        const response = await this.http.get<T>(path, { params });
        return response.data;
      } catch (error) {
        throw toCanvasError(error);
      }
    });
  }

  async getWithHeaders<T>(
    path: string,
    params?: Record<string, string | number | boolean>
  ): Promise<{ data: T; linkHeader: string | null }> {
    return withRetry(async () => {
      try {
        const response = await this.http.get<T>(path, { params });
        const linkHeader = (response.headers["link"] as string) ?? null;
        return { data: response.data, linkHeader };
      } catch (error) {
        throw toCanvasError(error);
      }
    });
  }
}
