# Architectuur

## Dataflow

```
Claude Desktop / Claude.ai
        |
        | MCP protocol (JSON-RPC via stdio)
        ↓
  canvas-claude-mcp (Node.js process)
        |
        | HTTP GET requests (axios)
        | Authorization: Bearer <token>
        ↓
  Canvas REST API (jouw school)
        |
        | JSON response
        ↓
  canvas-claude-mcp (formatteert output)
        |
        | Plain-text resultaat
        ↓
  Claude (interpreteert en beantwoordt)
```

## Bestandsstructuur en verantwoordelijkheden

| Bestand | Verantwoordelijkheid |
|---------|---------------------|
| `src/index.ts` | MCP server opstarten, tools registreren, requests afhandelen |
| `src/config.ts` | Env-variabelen laden en valideren bij opstart |
| `src/canvasClient.ts` | Alle HTTP-communicatie met Canvas API |
| `src/pagination.ts` | Canvas Link-header pagination doorlopen |
| `src/errors.ts` | Eigen error-types en gebruiksvriendelijke foutmeldingen |
| `src/tools/*.ts` | Eén bestand per Canvas-domein, elke tool als aparte functie |
| `src/utils/cleanHtml.ts` | HTML-tags verwijderen uit Canvas body-velden |
| `src/utils/formatDate.ts` | ISO-datums omzetten naar leesbaar Nederlands |

## Tool registratie

Elke `tools/*.ts` exporteert een array van tool-definities:

```typescript
{
  name: string,           // MCP tool naam
  description: string,   // uitleg voor Claude
  inputSchema: object,   // JSON Schema voor parameters
  handler: Function,     // async functie die de Canvas API aanroept
}
```

`index.ts` verzamelt alle arrays en registreert ze in één keer.

## Foutafhandeling

```
Canvas API fout
      ↓
axios gooit AxiosError
      ↓
canvasClient.ts vangt op, gooit CanvasApiError
      ↓
index.ts vangt op, retourneert isError: true naar Claude
      ↓
Claude krijgt leesbare foutmelding
```

Token wordt **nooit** opgenomen in foutmeldingen of logs.

## Configuratie

Bij opstart controleert `config.ts` of `CANVAS_BASE_URL` en `CANVAS_ACCESS_TOKEN` aanwezig zijn. Als een van beide ontbreekt, stopt de server direct met een duidelijke foutmelding. Zo wordt voorkomen dat de server draait met een ongeldige configuratie.
