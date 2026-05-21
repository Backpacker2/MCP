import axios, { AxiosInstance, AxiosError } from "axios";
import { CanvasApiError, statusCodeToMessage } from "./errors.js";

export interface CanvasClientOptions {
  baseUrl: string;
  accessToken: string;
}

export class CanvasClient {
  private http: AxiosInstance;

  constructor({ baseUrl, accessToken }: CanvasClientOptions) {
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

  async get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
    try {
      const response = await this.http.get<T>(path, { params });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status ?? 0;
        throw new CanvasApiError(status, statusCodeToMessage(status));
      }
      throw new CanvasApiError(0, "Onbekende fout bij aanroep van Canvas API.");
    }
  }

  async getWithHeaders<T>(
    path: string,
    params?: Record<string, string | number | boolean>
  ): Promise<{ data: T; linkHeader: string | null }> {
    try {
      const response = await this.http.get<T>(path, { params });
      const linkHeader = (response.headers["link"] as string) ?? null;
      return { data: response.data, linkHeader };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status ?? 0;
        throw new CanvasApiError(status, statusCodeToMessage(status));
      }
      throw new CanvasApiError(0, "Onbekende fout bij aanroep van Canvas API.");
    }
  }
}
