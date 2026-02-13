# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | Yes                |
| < 1.0   | No                 |

## Reporting a Vulnerability

If you discover a security vulnerability in this package, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email us at: **support@adlocaite.com**

Include the following in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## What to Expect

- We will acknowledge your report within **3 business days**
- We will provide an initial assessment within **7 business days**
- We will work with you to understand and resolve the issue

## Scope

This security policy covers:
- The HTML5 package code (`package/` directory)
- Build scripts (`build.sh`, `build.bat`)
- Test infrastructure (`test/`)

Out of scope:
- The Adlocaite API backend (report separately to support@adlocaite.com)
- Broadsign Control Player vulnerabilities (report to [Broadsign](https://broadsign.com))

## Security Best Practices

When using this package:
- **Never commit `config.js`** — it contains your API key
- **Keep your API key private** — do not share it in logs, screenshots, or public channels
- **Use HTTPS** for all API endpoints
- **Review debug logs** before sharing — they may contain screen IDs or API responses
