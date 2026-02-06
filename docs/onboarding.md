# Onboarding

Zero-to-hero checklist for new developers.

## Prerequisites

- [ ] Node.js 22+ installed
- [ ] pnpm installed (`npm install -g pnpm`)
- [ ] Git installed
- [ ] Docker (optional, for container deployment)

## Setup Steps

### 1. Clone Repository

```bash
git clone https://github.com/moshehbenavraham/crocbot.git
cd crocbot
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 4. Required Secrets

| Variable | Where to Get | Description |
|----------|--------------|-------------|
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com/) | Claude API access |
| `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/) | OpenAI API access (optional) |
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) | Telegram bot token |

### 5. Build and Start

```bash
# Build the project
pnpm build

# Run onboarding wizard (recommended)
pnpm crocbot onboard --install-daemon

# Or start gateway manually
pnpm crocbot gateway --port 18789 --verbose
```

### 6. Verify Setup

- [ ] Gateway responds at `http://localhost:18789/health`
- [ ] Tests pass: `pnpm test`
- [ ] Telegram bot responds to messages

## Development Workflow

```bash
# Dev loop with auto-reload
pnpm gateway:watch

# Run tests
pnpm test

# Build
pnpm build

# Lint
pnpm lint
```

## Common Issues

### Node version mismatch
**Solution**: Use Node 22+. Check with `node --version`.

### pnpm not found
**Solution**: Install pnpm globally: `npm install -g pnpm`

### Telegram bot not responding
**Solution**: Check bot token validity with @BotFather, verify gateway is running.

### Build errors
**Solution**: Run `pnpm install` to ensure dependencies are up to date.

## Next Steps

- Read [Development Guide](reference/development) for local development details
- Review [Architecture](ARCHITECTURE) for system overview
- Check [Gateway docs](/gateway) for control plane configuration
