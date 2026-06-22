import axios from "axios";
import { CanvasClient } from "../src/canvasClient";
import { CanvasApiError } from "../src/errors";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.useFakeTimers();

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

  it("retourneert data bij succesvolle GET", async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1, name: "Test Cursus" }], headers: {} });
    const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
    const result = await client.get<{ id: number; name: string }[]>("/api/v1/courses");
    expect(result).toEqual([{ id: 1, name: "Test Cursus" }]);
  });

  it("gooit CanvasApiError bij 401", async () => {
    const axiosError = { isAxiosError: true, response: { status: 401, headers: {} } };
    mockGet.mockRejectedValue(axiosError);
    mockedAxios.isAxiosError.mockReturnValue(true);

    const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "fout-token" });
    await expect(client.get("/api/v1/courses")).rejects.toThrow(CanvasApiError);
  });

  it("gooit CanvasApiError bij 404", async () => {
    const axiosError = { isAxiosError: true, response: { status: 404, headers: {} } };
    mockGet.mockRejectedValue(axiosError);
    mockedAxios.isAxiosError.mockReturnValue(true);

    const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
    await expect(client.get("/api/v1/courses/99999/assignments")).rejects.toThrow(CanvasApiError);
  });

  it("herprobeert bij 429 en slaagt op de tweede poging", async () => {
    const rateLimitError = { isAxiosError: true, response: { status: 429, headers: {} } };
    mockGet
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({ data: { id: 1 }, headers: {} });
    mockedAxios.isAxiosError.mockReturnValue(true);

    const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
    // Vang de rejection direct om een PromiseRejectionHandledWarning te voorkomen
    const settled = client.get("/api/v1/courses").then(
      (v) => ({ ok: true as const, value: v }),
      (e) => ({ ok: false as const, error: e })
    );

    await jest.runAllTimersAsync();

    const result = await settled;
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ id: 1 });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("gooit na 3 mislukte pogingen bij aanhoudende 429", async () => {
    const rateLimitError = { isAxiosError: true, response: { status: 429, headers: {} } };
    mockGet.mockRejectedValue(rateLimitError);
    mockedAxios.isAxiosError.mockReturnValue(true);

    const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
    const settled = client.get("/api/v1/courses").then(
      () => ({ ok: true as const }),
      (e: unknown) => ({ ok: false as const, error: e })
    );

    await jest.runAllTimersAsync();

    const result = await settled;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(CanvasApiError);
    expect(mockGet).toHaveBeenCalledTimes(3);
  });
});
