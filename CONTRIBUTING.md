# Contributing to Adlocaite Broadsign Integration

Thank you for your interest in contributing! This guide will help you get started.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

- Check [existing issues](https://github.com/Adlocaite/adlocaite-broadsign/issues) to avoid duplicates
- Use the [bug report template](https://github.com/Adlocaite/adlocaite-broadsign/issues/new?template=bug_report.md)
- Include steps to reproduce, expected vs. actual behavior, and your environment details

### Suggesting Features

- Use the [feature request template](https://github.com/Adlocaite/adlocaite-broadsign/issues/new?template=feature_request.md)
- Describe the use case and why the feature would be useful

### Security Vulnerabilities

**Do not open a public issue.** Please follow our [Security Policy](SECURITY.md).

## Development Setup

### Prerequisites

- Node.js (for local test server)
- A Unix shell (macOS/Linux) or Windows with `build.bat`

### Getting Started

1. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/adlocaite-broadsign.git
   cd adlocaite-broadsign
   ```

2. **Set up configuration**:
   ```bash
   cp package/js/config.example.js package/js/config.js
   # Edit config.js with your API key and settings
   ```

3. **Build the package**:
   ```bash
   ./build.sh
   ```

4. **Start the test server**:
   ```bash
   npm run test:serve
   # Open http://127.0.0.1:8000/test/
   ```

## Pull Request Process

### Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and test locally

3. Commit with a clear message:
   ```bash
   git commit -m "feat: add support for VAST 4.2 companions"
   ```

4. Push and open a Pull Request against `main`

### PR Requirements

- All status checks must pass
- Fill out the PR template completely
- Keep changes focused — one feature or fix per PR
- Update documentation if you add or change functionality

### Commit Messages

Use clear, descriptive commit messages. We recommend [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation changes
- `refactor:` — code restructuring without behavior change
- `test:` — adding or updating tests

## Code Standards

- **Language**: All code, comments, and documentation in English
- **Style**: Follow existing code patterns and structure
- **Modules**: Each class belongs in its own file under `package/js/`
- **Configuration**: Add new options to `config.example.js` with descriptive comments
- **Secrets**: Never commit `package/js/config.js` or any API keys

### Architecture

The codebase is modular — see the [Architecture section in CLAUDE.md](CLAUDE.md#architecture) for details on how the modules interact. When adding functionality:

- Delegate to specialized classes rather than adding logic to `index.html`
- Maintain compatibility with the `BroadSignPlay()` lifecycle
- Expose classes via `window.ClassName` for cross-module access

### Broadsign-Specific Notes

- The package runs in Chromium v87+ inside Broadsign Control Player
- Avoid modern JS features not supported in Chromium 87 (e.g., `Array.at()`, top-level `await`)
- Videos must use `muted: true` for autoplay compatibility
- Test in Broadsign Player for real-world validation — browser testing has limitations

## Getting Help

- Open a [GitHub Discussion](https://github.com/Adlocaite/adlocaite-broadsign/issues) or issue
- Email: support@adlocaite.com
- Documentation: [docs.adlocaite.com](https://docs.adlocaite.com)
