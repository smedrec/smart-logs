# Makefile for examples convenience

EXAMPLES_DIR=examples

.PHONY: up run down all

up:
	@echo "Starting example stack (OTLP + Redis)..."
	cd $(EXAMPLES_DIR) && docker compose up -d

run:
	@echo "Running Node example..."
	node $(EXAMPLES_DIR)/run-example.mjs

down:
	@echo "Stopping example stack..."
	cd $(EXAMPLES_DIR) && docker compose down

all: up run down
	@echo "Example complete"
