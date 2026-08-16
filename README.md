# BAWS-NN Risk Engine

**Bootstrap-Based Adaptive Window Selection & Neural Network** risk engine for credit-invisible, low-income, irregular-income borrowers.

Based on: *"Adaptive Window Selection for Financial Risk Forecasting"* — Li, Lyu & Wang (arXiv:2603.01157v2, 2026)

---

## Architecture

```
Raw Cash Flows → Preprocessing (STL) → BAWS Window Selector (MBB) →
Tail-Risk (VaR/ES via Fissler-Ziegel) → Neural MLP Scoring →
Dual Output: Trust Score [300-850] + Resilience Score [0-100%]
```

**Three-layer stack:**
- **Python** — Statistical core (NumPy/SciPy/statsmodels) + Neural network (PyTorch)
- **C++** — Performance kernel for MBB bootstrap (compiled to DLL/SO)
- **Node.js** — REST API server (Fastify) + C++ native bridge (koffi)

## Quick Start

### 1. Install Python Dependencies

```bash
pip install numpy scipy pandas statsmodels scikit-learn pydantic fastapi uvicorn pytest torch
```

### 2. Run Tests

```bash
python -m pytest tests/ -v --tb=short
```

### 3. Start the Python Dev API

```bash
python api/server.py
# → http://localhost:8000/docs (OpenAPI auto-docs)
```

### 4. Start the Node.js Production API

```bash
cd js_bridge
npm install
npm run dev
# → http://localhost:3000/api/v1/evaluate
```

### 5. Build the C++ Kernel (Optional)

```bash
cd cpp_core
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
```

## API Usage

```bash
curl -X POST http://localhost:8000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "borrowerId": "farmer-001",
    "grossInflows": [1200, 800, 1500, 400, 1100, 900, 1300, 700, 1400, 600, 1000, 1100],
    "grossOutflows": [700, 650, 800, 600, 750, 700, 780, 680, 720, 650, 700, 710],
    "liquidBuffers": [300, 250, 400, 200, 350, 280, 420, 240, 380, 220, 320, 310]
  }'
```

## Project Structure

```
baws_engine/           Python core package
  ├── config.py        Hyperparameters & constants
  ├── schemas.py       Pydantic I/O models (API contract)
  ├── preprocessing.py Signal conditioning (imputation, STL)
  ├── baws_selector.py Adaptive window selection + MBB
  ├── tail_risk.py     VaR/ES via Fissler-Ziegel
  ├── neural_extractor.py  MLP feature extractor + scoring
  └── engine.py        Full pipeline orchestrator

cpp_core/              C++ performance kernel
  ├── baws_engine.h    FFI header (extern C)
  ├── baws_engine.cpp  MBB bootstrap + break detection
  └── CMakeLists.txt   Build configuration

js_bridge/             Node.js API layer
  └── src/
      ├── nativeBridge.js  koffi bindings to C++ lib
      ├── engine.js        Orchestrator (Python + C++ + JS)
      └── server.js        Fastify REST API

api/                   Python FastAPI dev server
tests/                 Test suite
data/synthetic/        Synthetic data generators
```

## Key Mathematical Components

| Component | Formula | Purpose |
|-----------|---------|---------|
| MBB Block Length | `l_i = c⌈i^{1/3}⌉` | Preserve autocorrelation |
| Break Threshold | `τ(t,i) = β-quantile of bootstrap losses` | Adaptive structural break detection |
| Window Selection | `k̂_t = max{k : T_k = 0}` | Optimal look-back horizon |
| VaR Check Loss | `S(v,x) = (I(x<v) - α)(v - x)` | Non-parametric quantile estimation |
| Trust Score | `300 + 550 × σ(w'z + b)` | Composite creditworthiness |
| Resilience Score | `min(1, (B_t + μ⁺) / |ES_α|) × 100%` | Liquidity coverage |
