# infrastructure

This plugin adds eight DevOps and cloud specialists for AWS and Google Cloud architecture, Docker, Kubernetes, Terraform, GitHub Actions and GitLab CI. It also includes a security auditor that reviews a codebase and writes a prioritized report.

## Install

In Claude Code (v2.1.275 or later), one step:

```
/plugin install infrastructure --marketplace andisab/swe-marketplace
```

Or add the marketplace once, then install by name:

```
/plugin marketplace add andisab/swe-marketplace
/plugin install infrastructure@swe-marketplace
```

In Claude Desktop: **Customize → Plugins → Add → Add marketplace**, enter `andisab/swe-marketplace`, then install **infrastructure**. Shell commands, team settings, zip upload and claude.ai options are in the marketplace's [install guide](../../docs/install.md).

## Try it

- *"Have terraform-engineer turn the resources in infra/main.tf into a reusable module for our three environments."* The agent writes the module with its variables and outputs, and shows how each environment calls it.
- *"Use github-actions-expert to switch our deploy workflow from stored AWS keys to OIDC and pin every action to a commit SHA."* The agent rewrites the workflow and lists the IAM role and trust policy changes the switch needs.
- *"Run security-auditor on this repository."* The agent reviews authentication, input validation, data protection, APIs, dependencies and configuration, then writes `security-report.md` with findings rated Critical to Low and a remediation checklist.

## Agents

Claude Code lists each agent as `infrastructure:<name>`, for example `infrastructure:aws-cloud-architect`.

| Agent | Use it for |
|---|---|
| `aws-cloud-architect` | AWS architecture for EC2, EKS, Fargate and other services: service selection, cost optimization, security. |
| `gcp-cloud-architect` | Google Cloud architecture: GCE, GKE, Cloud Run, App Engine. |
| `infra-docker-engineer` | Docker and Compose: Dockerfile optimization, multi-container development environments. |
| `k8s-engineer` | Kubernetes: manifests, Helm charts, operators, GKE and EKS. |
| `terraform-engineer` | Terraform for AWS and GCP: reusable modules, state management, multi-cloud provisioning. |
| `github-actions-expert` | GitHub Actions: reusable workflows, OIDC, matrix builds, SHA pinning, least-privilege permissions. |
| `gitlab-ci-expert` | GitLab CI/CD: pipeline configuration, optimization, security. |
| `security-auditor` | Codebase security audits that end in `security-report.md`, with severity ratings and a remediation checklist. |

## How the agents work

Claude hands a task to one of these agents when the task matches the agent's description. You can also name the agent in your request, or pick it from `/agents`. Each agent works in its own context window and reports back when it's done, so a long investigation doesn't fill your main conversation. For a one-line question, asking Claude directly is fine.

## Questions

**Where does security-auditor put its report?** In a file named `security-report.md`, in the folder you name. If you don't name one, it suggests a location, such as the project root or `docs/security/`, and asks before writing.

**Do the agents need Context7?** No, but they use it when it's there. Every agent here except `infra-docker-engineer` and `security-auditor` can call the [Context7](https://context7.com) MCP server to look up current library documentation. Without it, an agent answers from the model's own knowledge, which can lag behind recent releases. To add Context7, run `/plugin install context7@claude-plugins-official`.

---

Part of [swe-marketplace](../../README.md). Changes are in the [changelog](../../CHANGELOG.md). Common questions are in the [FAQ](../../README.md#faq). MIT license.
