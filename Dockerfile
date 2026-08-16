# ─────────────────────────────────────────────────────────────────────
# BAWS-NN Engine — Multi-stage Dockerfile
#
# Stage 1: Build C++ kernel
# Stage 2: Install Python + Node.js deps, run everything
#
# Usage:
#   docker build -t baws-nn .
#   docker run baws-nn test          ← Run all tests
#   docker run baws-nn api           ← Start FastAPI dev server
#   docker run -it baws-nn shell     ← Interactive shell
# ─────────────────────────────────────────────────────────────────────

# ── Stage 1: Build C++ shared library ────────────────────────────────
FROM gcc:13 AS cpp-builder

WORKDIR /build
COPY cpp_core/ .

RUN apt-get update && apt-get install -y --no-install-recommends cmake \
    && cmake -B out -DCMAKE_BUILD_TYPE=Release \
    && cmake --build out --config Release


# ── Stage 2: Python + Node.js runtime ────────────────────────────────
FROM python:3.12-slim

# Install Node.js 20 LTS
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python dependencies ──────────────────────────────────────────────
COPY pyproject.toml .
RUN pip install --no-cache-dir \
    numpy scipy pandas statsmodels scikit-learn \
    pydantic fastapi uvicorn pytest pytest-cov \
    && pip install --no-cache-dir torch --extra-index-url https://download.pytorch.org/whl/cpu

# ── Copy project files ───────────────────────────────────────────────
COPY baws_engine/ baws_engine/
COPY data/ data/
COPY tests/ tests/
COPY api/ api/

# ── Copy compiled C++ library ────────────────────────────────────────
COPY --from=cpp-builder /build/out/libbaws_core.so /app/cpp_core/
COPY cpp_core/*.h /app/cpp_core/

# ── Node.js dependencies ─────────────────────────────────────────────
COPY js_bridge/ js_bridge/
RUN cd js_bridge && npm install --omit=dev 2>/dev/null || true

# ── Entrypoint ────────────────────────────────────────────────────────
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["test"]
