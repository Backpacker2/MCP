import { CanvasClient } from "../src/canvasClient";
import { CanvasApiError } from "../src/errors";
import { fetchAllPages } from "../src/pagination";

const mockClient = {
  getWithHeaders: jest.fn(),
} as unknown as CanvasClient;

beforeEach(() => jest.clearAllMocks());

// ─── fetchAllPages ───────────────────────────────────────────────────────────

describe("fetchAllPages", () => {
  it("haalt items op als er maar één pagina is", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{ id: 1 }, { id: 2 }],
      linkHeader: null,
    });
    const result = await fetchAllPages(mockClient, "/api/v1/courses");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 1 });
    expect(mockClient.getWithHeaders).toHaveBeenCalledTimes(1);
  });

  it("combineert items van meerdere pagina's via Link-header", async () => {
    (mockClient.getWithHeaders as jest.Mock)
      .mockResolvedValueOnce({
        data: [{ id: 1 }, { id: 2 }],
        linkHeader: '<https://school.example.com/api/v1/courses?page=2&per_page=100>; rel="next"',
      })
      .mockResolvedValueOnce({
        data: [{ id: 3 }],
        linkHeader: null,
      });
    const result = await fetchAllPages(mockClient, "/api/v1/courses");
    expect(result).toHaveLength(3);
    expect((result as { id: number }[]).map((r) => r.id)).toEqual([1, 2, 3]);
    expect(mockClient.getWithHeaders).toHaveBeenCalledTimes(2);
  });

  it("geeft lege array terug bij lege response", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [],
      linkHeader: null,
    });
    const result = await fetchAllPages(mockClient, "/api/v1/courses");
    expect(result).toEqual([]);
    expect(mockClient.getWithHeaders).toHaveBeenCalledTimes(1);
  });

  it("stuurt per_page 100 mee als standaardparameter", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    await fetchAllPages(mockClient, "/api/v1/courses");
    expect(mockClient.getWithHeaders).toHaveBeenCalledWith(
      "/api/v1/courses",
      expect.objectContaining({ per_page: 100 })
    );
  });

  it("voegt extra params samen met per_page", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    await fetchAllPages(mockClient, "/api/v1/courses", { enrollment_state: "active" });
    expect(mockClient.getWithHeaders).toHaveBeenCalledWith(
      "/api/v1/courses",
      expect.objectContaining({ per_page: 100, enrollment_state: "active" })
    );
  });

  it("stopt na de eerste pagina als Link-header geen rel=next heeft", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{ id: 1 }],
      linkHeader: '<https://school.example.com/api/v1/courses?page=1>; rel="prev"',
    });
    const result = await fetchAllPages(mockClient, "/api/v1/courses");
    expect(result).toHaveLength(1);
    expect(mockClient.getWithHeaders).toHaveBeenCalledTimes(1);
  });

  it("verwerkt Link-header met meerdere relaties correct", async () => {
    (mockClient.getWithHeaders as jest.Mock)
      .mockResolvedValueOnce({
        data: [{ id: 2 }],
        linkHeader: [
          '<https://school.example.com/api/v1/courses?page=1>; rel="prev"',
          '<https://school.example.com/api/v1/courses?page=3>; rel="next"',
          '<https://school.example.com/api/v1/courses?page=5>; rel="last"',
        ].join(", "),
      })
      .mockResolvedValueOnce({
        data: [{ id: 3 }],
        linkHeader: null,
      });
    const result = await fetchAllPages(mockClient, "/api/v1/courses");
    expect(result).toHaveLength(2);
    expect(mockClient.getWithHeaders).toHaveBeenCalledTimes(2);
  });

  it("verwerkt lege string als Link-header zonder te crashen", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{ id: 1 }],
      linkHeader: "",
    });
    const result = await fetchAllPages(mockClient, "/api/v1/courses");
    expect(result).toHaveLength(1);
    expect(mockClient.getWithHeaders).toHaveBeenCalledTimes(1);
  });

  it("gooit CanvasApiError door bij 404", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(
      new CanvasApiError(404, "Niet gevonden.")
    );
    await expect(
      fetchAllPages(mockClient, "/api/v1/courses/99999/modules")
    ).rejects.toThrow(CanvasApiError);
  });

  it("gooit CanvasApiError door bij 401", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(
      new CanvasApiError(401, "Ongeldige token.")
    );
    await expect(
      fetchAllPages(mockClient, "/api/v1/courses")
    ).rejects.toThrow(CanvasApiError);
  });

  it("gooit CanvasApiError door bij 429 (rate limit)", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(
      new CanvasApiError(429, "Rate limit bereikt.")
    );
    await expect(
      fetchAllPages(mockClient, "/api/v1/courses")
    ).rejects.toThrow(CanvasApiError);
  });

  it("stopt bij API-fout op de tweede pagina en gooit de fout door", async () => {
    (mockClient.getWithHeaders as jest.Mock)
      .mockResolvedValueOnce({
        data: [{ id: 1 }],
        linkHeader: '<https://school.example.com/api/v1/courses?page=2>; rel="next"',
      })
      .mockRejectedValueOnce(new CanvasApiError(500, "Server fout."));
    await expect(
      fetchAllPages(mockClient, "/api/v1/courses")
    ).rejects.toThrow(CanvasApiError);
  });

  it("gebruikt alleen het pad uit de next-URL, niet de volledige URL", async () => {
    (mockClient.getWithHeaders as jest.Mock)
      .mockResolvedValueOnce({
        data: [{ id: 1 }],
        linkHeader: '<https://school.example.com/api/v1/courses?page=2&per_page=100>; rel="next"',
      })
      .mockResolvedValueOnce({ data: [], linkHeader: null });

    await fetchAllPages(mockClient, "/api/v1/courses");

    const secondCall = (mockClient.getWithHeaders as jest.Mock).mock.calls[1];
    expect(secondCall[0]).toMatch(/^\/api\/v1\/courses/);
    expect(secondCall[0]).not.toContain("https://");
  });
});
