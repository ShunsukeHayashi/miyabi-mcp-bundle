---
name: network-diagnostics
description: Network connectivity diagnostics including ping, DNS lookup, port scanning, and HTTP requests. Use when debugging network issues, checking connectivity, or testing endpoints.
allowed-tools: Bash, Read, WebFetch
mcp_tools:
  - "network_ping"
  - "network_dns_lookup"
  - "network_port_check"
  - "network_interfaces"
  - "network_connections"
  - "network_route"
  - "network_arp"
  - "network_bandwidth"
  - "network_latency"
  - "network_traceroute"
  - "network_whois"
  - "network_ssl_check"
  - "network_http_request"
  - "network_websocket_test"
  - "network_public_ip"
---

# Network Diagnostics Skill

**Version**: 1.0.0
**Purpose**: Network connectivity diagnostics and troubleshooting

---

## Triggers

| Trigger | Examples |
|---------|----------|
| Ping | "ping host", "check connectivity", "疎通確認" |
| DNS | "DNS lookup", "resolve domain", "名前解決" |
| Ports | "check port", "port scan", "ポート確認" |
| HTTP | "test endpoint", "HTTP request", "API確認" |

---

## Integrated MCP Tools

### Connectivity Tests

| Tool | Purpose |
|------|---------|
| `network_ping` | ICMP ping test |
| `network_dns_lookup` | DNS resolution |
| `network_port_check` | Port availability |
| `network_traceroute` | Route tracing |
| `network_latency` | Latency measurement |

### Interface Information

| Tool | Purpose |
|------|---------|
| `network_interfaces` | Network interface list |
| `network_connections` | Active connections |
| `network_route` | Routing table |
| `network_arp` | ARP cache |
| `network_public_ip` | External IP address |

### Advanced Tests

| Tool | Purpose |
|------|---------|
| `network_bandwidth` | Bandwidth test |
| `network_whois` | Domain WHOIS lookup |
| `network_ssl_check` | SSL certificate check |
| `network_http_request` | HTTP request test |
| `network_websocket_test` | WebSocket connectivity |

---

## Workflow: Connectivity Troubleshooting

### Phase 1: Basic Connectivity

#### Step 1.1: Check Local Interface
```
Use network_interfaces to verify:
- Interface is up
- IP address assigned
- No errors
```

#### Step 1.2: Ping Test
```
Use network_ping with:
- host: Target IP or hostname
- count: 4 (default)
```

### Phase 2: DNS Resolution

#### Step 2.1: DNS Lookup
```
Use network_dns_lookup with:
- domain: Target domain
- type: A, AAAA, MX, etc.
```

#### Step 2.2: Verify Resolution
Check for:
- Correct IP returned
- Response time
- TTL values

### Phase 3: Port & Service

#### Step 3.1: Port Check
```
Use network_port_check with:
- host: Target host
- port: Service port (80, 443, etc.)
```

#### Step 3.2: HTTP Test
```
Use network_http_request with:
- url: Full URL
- method: GET, POST, etc.
```

### Phase 4: Route Analysis

#### Step 4.1: Traceroute
```
Use network_traceroute with:
- host: Destination
- max_hops: 30
```

#### Step 4.2: Identify Bottlenecks
Look for:
- High latency hops
- Packet loss
- Route changes

---

## Common Issues

| Symptom | Tool | Check |
|---------|------|-------|
| Can't resolve | network_dns_lookup | DNS server, domain |
| Connection refused | network_port_check | Port, firewall |
| High latency | network_latency | Route, bandwidth |
| SSL errors | network_ssl_check | Certificate validity |
| No route | network_route | Routing table |

---

## Best Practices

✅ GOOD:
- Start with basic ping
- Check DNS separately
- Verify SSL certificates
- Test from multiple locations

❌ BAD:
- Skip basic checks
- Assume DNS is working
- Ignore SSL warnings
- Test only once

---

## Checklist

- [ ] Local interface up
- [ ] Gateway reachable (ping)
- [ ] DNS resolution working
- [ ] Target port open
- [ ] SSL certificate valid
- [ ] Latency acceptable
