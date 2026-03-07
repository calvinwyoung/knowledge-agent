.PHONY: gaia-claude-agent-sdk-sample
gaia-claude-agent-sdk-sample:
	pnpm dev run --agent claude-agent-sdk --benchmark gaia --file ./data/gaia/2023/validation/metadata.parquet --level 1 --concurrency 3 --limit 3

.PHONY: gaia-claude-agent-sdk-all
gaia-claude-agent-sdk-all:
	pnpm dev run --agent claude-agent-sdk --benchmark gaia --file ./data/gaia/2023/validation/metadata.parquet --level 1 --concurrency 10

.PHONY: gaia-pi-coding-agent-sample
gaia-pi-coding-agent-sample:
	pnpm dev run --agent pi-coding-agent --benchmark gaia --file ./data/gaia/2023/validation/metadata.parquet --level 1 --concurrency 3 --limit 3

.PHONY: gaia-pi-coding-agent-all
gaia-pi-coding-agent-all:
	pnpm dev run --agent pi-coding-agent --benchmark gaia --file ./data/gaia/2023/validation/metadata.parquet --level 1 --concurrency 10

.PHONY: gaia-pi-coding-agent-with-tools-sample
gaia-pi-coding-agent-with-tools-sample:
	pnpm dev run --agent pi-coding-agent-with-tools --benchmark gaia --file ./data/gaia/2023/validation/metadata.parquet --level 1 --concurrency 3 --limit 3

.PHONY: gaia-pi-coding-agent-with-tools-all
gaia-pi-coding-agent-with-tools-all:
	pnpm dev run --agent pi-coding-agent-with-tools --benchmark gaia --file ./data/gaia/2023/validation/metadata.parquet --level 1 --concurrency 10

.PHONY: download-datasetes
download-datasets:
	uvx hf download gaia-benchmark/GAIA --repo-type dataset --local-dir data/gaia

.PHONY: dev
dev:
	pnpm dev

.PHONY: build
build:
	pnpm build

.PHONY: start
start:
	pnpm start

.PHONY: test
test:
	pnpm test

.PHONY: check-and-fix
check-and-fix:
	pnpm check-and-fix
