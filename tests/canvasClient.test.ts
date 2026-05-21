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

  it("retourneert data bij succesvolle GET", async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1, name: "Test Cursus" }], headers: {} });
    const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
    const result = await client.get<{ id: number; name: string }[]>("/api/v1/courses");
    expect(result).toEqual([{ id: 1, name: "Test Cursus" }]);
  });

  it("gooit CanvasApiError bij 401", async () => {
    const axiosError = { isAxiosError: true, response: { status: 401 } };
    mockGet.mockRejectedValue(axiosError);
    mockedAxios.isAxiosError.mockReturnValue(true);

    const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "fout-token" });
    await expect(client.get("/api/v1/courses")).rejects.toThrow(CanvasApiError);
  });

  it("gooit CanvasApiError bij 404", async () => {
    const axiosError = { isAxiosError: true, response: { status: 404 } };
    mockGet.mockRejectedValue(axiosError);
    mockedAxios.isAxiosError.mockReturnValue(true);

    const client = new CanvasClient({ baseUrl: "https://school.example.com", accessToken: "token" });
    await expect(client.get("/api/v1/courses/99999/assignments")).rejects.toThrow(CanvasApiError);
  });
});
