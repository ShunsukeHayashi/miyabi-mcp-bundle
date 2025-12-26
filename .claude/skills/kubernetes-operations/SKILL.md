---
name: kubernetes-operations
description: Kubernetes cluster operations including pods, services, deployments, and logs. Use when managing Kubernetes workloads, debugging pod issues, or checking cluster status.
allowed-tools: Bash, Read, Write
mcp_tools:
  - "k8s_pods"
  - "k8s_services"
  - "k8s_deployments"
  - "k8s_pod_logs"
  - "k8s_pod_describe"
  - "k8s_namespaces"
---

# Kubernetes Operations Skill

**Version**: 1.0.0
**Purpose**: Kubernetes cluster management and debugging

---

## Triggers

| Trigger | Examples |
|---------|----------|
| Pods | "list pods", "pod status", "Pod一覧" |
| Services | "list services", "サービス一覧" |
| Logs | "pod logs", "ログ確認" |
| Debug | "debug pod", "Pod調査" |

---

## Prerequisites

```bash
# kubectl configured with cluster access
kubectl cluster-info

# Optional: Set default namespace
kubectl config set-context --current --namespace=myapp
```

---

## Integrated MCP Tools

| Tool | Purpose |
|------|---------|
| `k8s_pods` | List pods in namespace |
| `k8s_services` | List services |
| `k8s_deployments` | List deployments |
| `k8s_pod_logs` | Pod container logs |
| `k8s_pod_describe` | Detailed pod info |
| `k8s_namespaces` | List namespaces |

---

## Workflow: Pod Debugging

### Phase 1: Assessment

#### Step 1.1: List Pods
```
Use k8s_pods with:
- namespace: Target namespace (or default)
```

Check for:
- Pod status (Running, Pending, Failed)
- Restart count
- Age

#### Step 1.2: Check Services
```
Use k8s_services to verify:
- Service endpoints
- Port mappings
- Selectors
```

### Phase 2: Investigation

#### Step 2.1: Pod Details
```
Use k8s_pod_describe with:
- pod_name: Target pod
- namespace: Pod namespace

Look for:
- Events (warnings, errors)
- Container status
- Resource limits
- Node assignment
```

#### Step 2.2: View Logs
```
Use k8s_pod_logs with:
- pod_name: Target pod
- container: Container name (if multi-container)
- tail: 100 (last N lines)
- previous: true (if crashed)
```

### Phase 3: Common Fixes

| Status | Cause | Solution |
|--------|-------|----------|
| Pending | No resources | Check node capacity |
| CrashLoopBackOff | App error | Check logs, fix code |
| ImagePullBackOff | Image issue | Verify image name, credentials |
| OOMKilled | Memory limit | Increase memory limit |

---

## Quick Reference

### Pod States
```
Pending    → Waiting for scheduling
Running    → Container(s) running
Succeeded  → Completed successfully
Failed     → Container exited with error
Unknown    → State cannot be determined
```

### Common Commands
```bash
# Get all resources
kubectl get all -n namespace

# Watch pods
kubectl get pods -w

# Exec into pod
kubectl exec -it pod-name -- /bin/sh
```

---

## Best Practices

✅ GOOD:
- Set resource requests/limits
- Use liveness/readiness probes
- Check events on failures
- Use namespaces for isolation

❌ BAD:
- No resource limits
- Ignore probe failures
- Delete pods without investigation
- Run everything in default namespace

---

## Checklist

- [ ] kubectl configured
- [ ] Namespace specified
- [ ] Pod status checked
- [ ] Events reviewed
- [ ] Logs examined
- [ ] Resources adequate
