# Doc Detective Common

Shared components for Doc Detective projects.

## 📦 Installation

```bash
# Install stable version
npm install doc-detective-common

# Install latest development version
npm install doc-detective-common@dev
```

## 🚀 Development Releases

This package automatically publishes development versions on every commit to the main branch. This enables dependent libraries to consume the latest changes without waiting for formal releases.

- **Dev versions** follow the pattern: `3.1.0-dev.1`, `3.1.0-dev.2`, etc.
- **Available via npm**: `npm install doc-detective-common@dev`
- **Documentation**: See [Auto Dev Release Guide](./docs/auto-dev-release.md)

## 📚 API

This package exports the following components:

- `schemas` - JSON schemas for validation
- `validate` - Validation functions
- `resolvePaths` - Path resolution utilities
- `readFile` - File reading utilities
- `transformToSchemaKey` - Schema key transformation

## 🧪 Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build schemas
npm run build
```

## 📄 License

AGPL-3.0-only