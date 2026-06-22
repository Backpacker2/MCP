import axios from "axios";
import { CanvasClient } from "../src/canvasClient";
import { CanvasApiError } from "../src/errors";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("CanvasClient", () => {
  const mockGet = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue({
      get: mockGet,
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    } as unknown as ReturnType<typeof axios.create>);
  });

  // ─── get() ─────────────────────────────────────────────────────────────────

  describe("get()", () => {
    it("retourneert data bij succesvolle GET", async () => {
      mockGet.mockResolvedValue({ data: [{ id: 1, name: "Test Cursus" }], headers: {} });
      const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
      const result = await client.get<{ id: number; name: string }[]>("/api/v1/courses");
      expect(result).toEqual([{ id: 1, name: "Test Cursus" }]);
    });

    it("retourneert lege array zonder te crashen", async () => {
      mockGet.mockResolvedValue({ data: [], headers: {} });
      const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
      const result = await client.get("/api/v1/courses");
      expect(result).toEqual([]);
    });

    it("gooit CanvasApiError met statusCode 401 bij ongeldig token", async () => {
      const axiosError = { isAxiosError: true, response: { status: 401 } };
      mockGet.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "fout-token" });
      const error = await client.get("/api/v1/courses").catch((e) => e) as CanvasApiError;
      expect(error).toBeInstanceOf(CanvasApiError);
      expect(error.statusCode).toBe(401);
    });

    it("gooit CanvasApiError met statusCode 403 bij geen toegang", async () => {
      const axiosError = { isAxiosError: true, response: { status: 403 } };
      mockGet.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
      await expect(client.get("/api/v1/courses/1/assignments")).rejects.toThrow(CanvasApiError);
    });

    it("gooit CanvasApiError met statusCode 404 bij niet-bestaande resource", async () => {
      const axiosError = { isAxiosError: true, response: { status: 404 } };
      mockGet.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
      const error = await client.get("/api/v1/courses/99999/assignments").catch((e) => e) as CanvasApiError;
      expect(error).toBeInstanceOf(CanvasApiError);
      expect(error.statusCode).toBe(404);
    });

    it("gooit CanvasApiError met statusCode 429 bij rate limit", async () => {
      const axiosError = { isAxiosError: true, response: { status: 429 } };
      mockGet.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
      const error = await client.get("/api/v1/courses").catch((e) => e) as CanvasApiError;
      expect(error).toBeInstanceOf(CanvasApiError);
      expect(error.statusCode).toBe(429);
    });

    it("gooit CanvasApiError met statusCode 500 bij serverfout", async () => {
      const axiosError = { isAxiosError: true, response: { status: 500 } };
      mockGet.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
      const error = await client.get("/api/v1/courses").catch((e) => e) as CanvasApiError;
      expect(error).toBeInstanceOf(CanvasApiError);
      expect(error.statusCode).toBe(500);
    });

    it("gooit CanvasApiError bij netwerkfout (geen response)", async () => {
      const networkError = { isAxiosError: true, response: undefined };
      mockGet.mockRejectedValue(networkError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
      const error = await client.get("/api/v1/courses").catch((e) => e) as CanvasApiError;
      expect(error).toBeInstanceOf(CanvasApiError);
      expect(error.statusCode).toBe(0);
    });

    it("gooit CanvasApiError bij niet-axios fout (bijv. timeout of JSON-fout)", async () => {
      mockGet.mockRejectedValue(new Error("Network timeout"));
      mockedAxios.isAxiosError.mockReturnValue(false);

      const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
      await expect(client.get("/api/v1/courses")).rejects.toThrow(CanvasApiError);
    });
  });

  // ─── getWithHeaders() ──────────────────────────────────────────────────────

  describe("getWithHeaders()", () => {
    it("retourneert data én de Link-header als die aanwezig is", async () => {
      const linkHeader = '<https://school.example.com/api/v1/courses?page=2>; rel="next"';
      mockGet.mockResolvedValue({
        data: [{ id: 1 }],
        headers: { link: linkHeader },
      });
      const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
      const result = await client.getWithHeaders("/api/v1/courses");
      expect(result.data).toEqual([{ id: 1 }]);
      expect(result.linkHeader).toBe(linkHeader);
    });

    it("retourneert null als Link-header ontbreekt", async () => {
      mockGet.mockResolvedValue({ data: [{ id: 1 }], headers: {} });
      const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
      const result = await client.getWithHeaders("/api/v1/courses");
      expect(result.linkHeader).toBeNull();
    });

    it("gooit CanvasApiError bij 401", async () => {
      const axiosError = { isAxiosError: true, response: { status: 401 } };
      mockGet.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "fout-token" });
      await expect(client.getWithHeaders("/api/v1/courses")).rejects.toThrow(CanvasApiError);
    });

    it("gooit CanvasApiError bij netwerkfout zonder response", async () => {
      const networkError = { isAxiosError: true, response: undefined };
      mockGet.mockRejectedValue(networkError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
      const error = await client.getWithHeaders("/api/v1/courses").catch((e) => e) as CanvasApiError;
      expect(error).toBeInstanceOf(CanvasApiError);
      expect(error.statusCode).toBe(0);
    });

    it("gooit CanvasApiError bij niet-axios fout", async () => {
      mockGet.mockRejectedValue(new TypeError("Failed to fetch"));
      mockedAxios.isAxiosError.mockReturnValue(false);

      const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
      await expect(client.getWithHeaders("/api/v1/courses")).rejects.toThrow(CanvasApiError);
    });
  });
});
