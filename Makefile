.PHONY: all install build start dev test coverage clean inspect help

# Standaard doel
all: install build

## Installeer dependencies
install:
	npm install

## Compileer TypeScript naar dist/
build:
	npm run build

## Start de gebouwde server (vereist .env)
start: build
	npm start

## Start de server direct vanuit broncode (vereist .env)
dev:
	npm run dev

## Draai alle unit tests
test:
	npm test

## Draai tests met code coverage rapport
coverage:
	npm run test:coverage

## Verwijder de dist/ map
clean:
	npm run clean

## Start MCP Inspector (vereist een gebouwde dist/)
inspect: build
	npx @modelcontextprotocol/inspector node dist/index.js

## Toon beschikbare make-doelen
help:
	@echo ""
	@echo "Canvas Claude MCP — beschikbare make-doelen:"
	@echo ""
	@echo "  make install     Installeer npm dependencies"
	@echo "  make build       Compileer TypeScript naar dist/"
	@echo "  make start       Bouw en start de MCP server"
	@echo "  make dev         Start server direct vanuit broncode (tsx)"
	@echo "  make test        Draai alle unit tests"
	@echo "  make coverage    Draai tests met coverage rapport"
	@echo "  make clean       Verwijder de dist/ map"
	@echo "  make inspect     Start MCP Inspector voor handmatig testen"
	@echo "  make help        Toon dit overzicht"
	@echo ""
	@echo "Eerste keer opstarten:"
	@echo "  cp .env.example .env  # Vul CANVAS_BASE_URL en CANVAS_ACCESS_TOKEN in"
	@echo "  make all              # Installeert en bouwt"
	@echo "  make inspect          # Test tools via browser UI"
	@echo ""
