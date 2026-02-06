# .github/

GitHub repository configuration and CI/CD workflows.

## Structure

```
.github/
  ISSUE_TEMPLATE/       # Bug report and feature request templates
  workflows/            # GitHub Actions CI/CD pipelines
  FUNDING.yml           # Sponsorship configuration
  actionlint.yaml       # GitHub Actions linter config
  dependabot.yml        # Automated dependency updates
  labeler.yml           # Auto-labeling rules for PRs
```

## Workflows

| Workflow | Purpose |
|----------|---------|
| `ci.yml` | Main CI pipeline: build, lint, type-check, test |
| `docker-release.yml` | Docker image build and push |
| `integration.yml` | Integration test suite |
| `security.yml` | SAST scanning and dependency audit (CodeQL v4) |
| `backup.yml` | Automated backup workflow |
| `auto-response.yml` | Auto-responses on issues/PRs |
| `labeler.yml` | Automatic label assignment |
| `workflow-sanity.yml` | Validates workflow files themselves |

## Issue Templates

- **bug_report.md** — structured bug report with repro steps
- **feature_request.md** — feature proposal template
- **config.yml** — template chooser configuration
