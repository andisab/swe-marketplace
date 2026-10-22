# infrastructure

DevOps, cloud and platform specialists: AWS, GCP, containers, Kubernetes, Terraform, CI/CD, and security audits.

Part of the [swe-marketplace](../../README.md) plugin catalog.

## Agents

| Agent | Use it for |
|---|---|
| `infra-aws-architect` | AWS architecture: service selection, cost optimization, security. |
| `infra-gcp-architect` | Google Cloud architecture: GCE, GKE, Cloud Run, App Engine. |
| `infra-docker-engineer` | Docker and Compose: Dockerfile optimization, multi-container development environments. |
| `infra-k8s-engineer` | Kubernetes: manifests, Helm charts, operators, GKE and EKS. |
| `infra-terraform-engineer` | Terraform: reusable modules, state management, multi-cloud provisioning. |
| `infra-github-actions-expert` | GitHub Actions: reusable workflows, OIDC, matrix builds, security hardening. |
| `infra-gitlab-ci-expert` | GitLab CI/CD: pipeline configuration, optimization, security. |
| `infra-security-auditor` | Codebase security audits with a prioritized remediation report. |

Claude picks an agent when a task matches its description. You can also ask for one by name ("use infra-aws-architect to …") or choose it from `/agents`.

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

In Claude Desktop: **Customize → Plugins → Add → Add marketplace**, enter `andisab/swe-marketplace`, then install **infrastructure**. Shell commands, team settings, zip upload and claude.ai options are in the [marketplace README](../../README.md#install).
