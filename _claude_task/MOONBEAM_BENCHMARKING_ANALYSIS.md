# Moonbeam Benchmarking Analysis

## Overview

Moonbeam has developed a comprehensive benchmarking infrastructure that automates weight generation, tracks performance changes, and ensures consistent runtime performance across their EVM-compatible Substrate chains.

## Key Components

### 1. GitHub Actions Workflows

#### check-benchmarks.yml
- **Schedule**: Runs automatically on Sundays and Wednesdays at 5:00 AM UTC
- **Purpose**: Validates all runtime benchmarks to ensure they compile and run correctly
- **Infrastructure**: Uses dedicated bare-metal runners for consistent performance
- **Tool**: Downloads and uses `frame-omni-bencher` from GitHub releases
- **Coverage**: Benchmarks all three runtimes (moonbeam, moonbase, moonriver)

```yaml
# Key configuration
- Rust optimization flags
- Mold linker for faster builds
- 50 steps, 20 repetitions per benchmark
- WASM execution mode
```

#### weight-diff-report.yml
- **Trigger**: Pull requests that modify weight files
- **Purpose**: Analyze performance impact of changes
- **Tool**: Uses `subweight` for weight comparison
- **Output**: 
  - CSV reports for detailed analysis
  - JSON data for programmatic access
  - Markdown summaries posted as PR comments

### 2. Benchmarking Scripts

#### scripts/run-benches-for-runtime.sh
Primary automation script for comprehensive runtime benchmarking:

```bash
#!/bin/bash
# Configuration
BENCHMARK_STEPS=50
BENCHMARK_REPEAT=20
BENCHMARK_EXECUTION=wasm

# Features
- Automatic pallet discovery
- Weight file generation with templates
- Error logging and recovery
- Continues on individual pallet failures
```

**Usage**:
```bash
./scripts/run-benches-for-runtime.sh moonbase
./scripts/run-benches-for-runtime.sh moonbeam
./scripts/run-benches-for-runtime.sh moonriver
```

#### scripts/benchmarking.sh
Interactive benchmarking tool for developers:

```bash
# Interactive mode
./scripts/benchmarking.sh

# Check mode (quick validation with fewer steps)
./scripts/benchmarking.sh --check

# Benchmark all pallets
./scripts/benchmarking.sh --all

# Output JSON results
./scripts/benchmarking.sh --json
```

**Features**:
- Interactive pallet selection menu
- Configurable step/repeat counts
- Quick check mode for development
- JSON output for automation

### 3. Benchmarking Architecture

#### Pallet Structure
```
pallets/
├── pallet-name/
│   ├── src/
│   │   ├── benchmarking.rs    # Benchmark implementations
│   │   └── weights.rs          # Generated weight files
│   └── Cargo.toml             # With runtime-benchmarks feature
```

#### Runtime Integration
```
runtime/
├── moonbase/
│   ├── src/
│   │   └── weights/           # All pallet weights
│   └── Cargo.toml
```

### 4. Special Considerations

#### Precompile Benchmarks
Moonbeam includes custom benchmarking for EVM precompiles:
- Located in `precompiles/` directory
- Special handling for EVM gas costs
- Integration with Substrate weight system

#### XCM Benchmarks
Cross-chain messaging benchmarks:
- Custom XCM weight calculations
- Integration with relay chain benchmarks
- Special handling for multi-location operations

### 5. Development Workflow

1. **Local Development**:
   ```bash
   # Quick check during development
   ./scripts/benchmarking.sh --check
   
   # Full benchmark before PR
   ./scripts/benchmarking.sh --all
   ```

2. **CI Pipeline**:
   - Automatic benchmark validation on schedule
   - Weight difference reports on PRs
   - Performance regression detection

3. **Weight Updates**:
   ```bash
   # Generate new weights for a runtime
   ./scripts/run-benches-for-runtime.sh moonbase
   
   # Commit generated weight files
   git add runtime/moonbase/src/weights/
   git commit -m "Update moonbase weights"
   ```

### 6. Best Practices from Moonbeam

1. **Automated Validation**: Regular scheduled benchmarks catch regressions early
2. **Performance Tracking**: Weight diff reports provide visibility into changes
3. **Bare-metal Runners**: Dedicated hardware ensures consistent results
4. **Error Recovery**: Scripts continue on failure, logging errors for review
5. **Interactive Tools**: Developer-friendly scripts for local testing
6. **Comprehensive Coverage**: All pallets benchmarked automatically

### 7. Tools and Dependencies

- **frame-omni-bencher**: Core benchmarking tool (downloaded from releases)
- **subweight**: Weight comparison and analysis
- **Handlebars**: Template engine for weight file generation
- **Custom scripts**: Automation and developer experience

### 8. Configuration Parameters

```bash
# Standard configuration across scripts
STEPS=50           # Number of sample points
REPEAT=20          # Repetitions per sample
EXECUTION=wasm     # Execution mode
HEAP_PAGES=4096    # Memory allocation

# Check mode (faster)
CHECK_STEPS=2
CHECK_REPEAT=1
```

## Recommendations for DataHaven

Based on Moonbeam's approach, consider implementing:

1. **Automated Scripts**: Create similar `run-benches-for-runtime.sh` for DataHaven
2. **CI Integration**: Set up scheduled benchmark validation
3. **Weight Tracking**: Implement weight difference reporting for PRs
4. **Interactive Tools**: Provide developer-friendly benchmarking scripts
5. **Error Handling**: Ensure scripts can recover from individual failures
6. **Documentation**: Maintain clear benchmarking guidelines

## Key Takeaways

Moonbeam's benchmarking infrastructure demonstrates:
- **Automation First**: Minimize manual intervention
- **Continuous Validation**: Regular checks prevent regressions
- **Developer Experience**: Interactive tools for local development
- **Performance Visibility**: Clear reporting of weight changes
- **Robust Error Handling**: Scripts that handle failures gracefully