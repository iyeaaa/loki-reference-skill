---
name: loki-reference
displayName: Loki Reference
description: Comprehensive reference for Grafana Loki - log aggregation system with LogQL queries, configuration, and operations
version: "1.0.0"
author: MoAI-ADK
tags:
  - loki
  - logging
  - logql
  - grafana
  - observability
keywords:
  - loki
  - logi
  - 로키
  - grafana loki
  - logql
  - log aggregation
  - log storage
  - promtail
  - log query
  - log monitoring
triggers:
  - pattern: "loki"
    scope: keyword
  - pattern: "logi"
    scope: keyword
  - pattern: "로그.*저장|로그.*검색|로그.*수집"
    scope: semantic
  - pattern: "logql"
    scope: keyword
  - pattern: "promtail"
    scope: keyword
context7_libraries:
  - name: "@grafana/loki"
    version: "latest"
---

# Loki Comprehensive Reference

## Overview

Grafana Loki is a horizontally scalable, highly available, multi-tenant log aggregation system inspired by Prometheus. It integrates with Grafana for visualization and uses LogQL (Log Query Language) for powerful log searching.

---

## Documentation Links

### Main Documentation
| Section | Link | Description |
|---------|------|-------------|
| **Loki Documentation** | https://grafana.com/docs/loki/latest/ | Official Loki documentation homepage |
| **Release Notes** | https://grafana.com/docs/loki/latest/release-notes/ | Version history and release cadence |

---

### 1. Get Started

| Section | Link | Description |
|---------|------|-------------|
| **Loki Overview** | https://grafana.com/docs/loki/latest/get-started/overview/ | Introduction to Loki architecture and concepts |
| **Quick Start** | https://grafana.com/docs/loki/latest/get-started/quick-start/ | Get Loki running in minutes |
| **Architecture** | https://grafana.com/docs/loki/latest/get-started/architecture/ | Component architecture and data flow |
| **Components** | https://grafana.com/docs/loki/latest/get-started/components/ | Ingester, Querier, Ruler, Gateway, and more |
| **Deployment Modes** | https://grafana.com/docs/loki/latest/get-started/deployment-modes/ | Monolithic, scalable, and microservices modes |
| **Labels** | https://grafana.com/docs/loki/latest/get-started/labels/ | Understanding labels and cardinality |
| **Label Best Practices** | https://grafana.com/docs/loki/latest/get-started/labels/bp-labels/ | Guidelines for effective label usage |
| **Cardinality** | https://grafana.com/docs/loki/latest/get-started/labels/cardinality/ | Managing label cardinality |
| **Structured Metadata** | https://grafana.com/docs/loki/latest/get-started/labels/structured-metadata/ | Using structured metadata in Loki |
| **Hash Rings** | https://grafana.com/docs/loki/latest/get-started/hash-rings/ | Hash ring mechanism for distribution |

---

### 2. Set Up

| Section | Link | Description |
|---------|------|-------------|
| **Size the Cluster** | https://grafana.com/docs/loki/latest/setup/size/ | Resource planning and sizing guide |
| **Install - Overview** | https://grafana.com/docs/loki/latest/setup/install/ | Installation methods overview |
| **Helm Installation** | https://grafana.com/docs/loki/latest/setup/install/helm/ | Install Loki using Kubernetes Helm charts |
| **Monolithic Mode** | https://grafana.com/docs/loki/latest/setup/install/helm/install-monolithic/ | Single binary deployment |
| **Microservices Mode** | https://grafana.com/docs/loki/latest/setup/install/helm/install-microservices/ | Microservices deployment |
| **Scalable Mode** | https://grafana.com/docs/loki/latest/setup/install/helm/install-scalable/ | Scalable deployment with read/write path separation |
| **Docker** | https://grafana.com/docs/loki/latest/setup/install/docker/ | Docker installation |
| **Local Installation** | https://grafana.com/docs/loki/latest/setup/install/local/ | Local development setup |
| **Istio** | https://grafana.com/docs/loki/latest/setup/install/istio/ | Istio service mesh integration |
| **From Source** | https://grafana.com/docs/loki/latest/setup/install/install-from-source/ | Build and install from source |
| **Migration** | https://grafana.com/docs/loki/latest/setup/migrate/ | Migration guides between versions and modes |
| **Upgrade** | https://grafana.com/docs/loki/latest/setup/upgrade/ | Upgrade procedures and version compatibility |

---

### 3. Configure

| Section | Link | Description |
|---------|------|-------------|
| **Best Practices** | https://grafana.com/docs/loki/latest/configure/bp-configure/ | Configuration best practices |
| **Storage** | https://grafana.com/docs/loki/latest/configure/storage/ | Storage backend configuration (S3, GCS, Azure, etc.) |
| **Configuration Examples** | https://grafana.com/docs/loki/latest/configure/examples/configuration-examples/ | Sample configurations for various scenarios |

---

### 4. Send Data (Log Ingestion)

| Section | Link | Description |
|---------|------|-------------|
| **Grafana Alloy** | https://grafana.com/docs/loki/latest/send-data/alloy/ | Send logs using Grafana Alloy |
| **OpenTelemetry** | https://grafana.com/docs/loki/latest/send-data/otel/ | OTLP native endpoint vs Loki exporter |
| **Promtail** | https://grafana.com/docs/loki/latest/send-data/promtail/ | Promtail agent for log collection |
| **Promtail Installation** | https://grafana.com/docs/loki/latest/send-data/promtail/installation/ | Installing Promtail |
| **Promtail Configuration** | https://grafana.com/docs/loki/latest/send-data/promtail/configuration/ | Promtail configuration reference |
| **Promtail Cloud Configs** | https://grafana.com/docs/loki/latest/send-data/promtail/cloud/ | Cloud-specific configurations (AWS, GCP, Azure) |
| **Service Discovery** | https://grafana.com/docs/loki/latest/send-data/promtail/scraping/ | Kubernetes service discovery |
| **Pipeline Stages** | https://grafana.com/docs/loki/latest/send-data/promtail/stages/ | Promtail pipeline stages reference (json, regex, labels, etc.) |
| **Docker Driver** | https://grafana.com/docs/loki/latest/send-data/docker-driver/ | Docker logging driver |
| **Fluent Bit** | https://grafana.com/docs/loki/latest/send-data/fluentbit/ | Fluent Bit plugin |
| **Fluentd** | https://grafana.com/docs/loki/latest/send-data/fluentd/ | Fluentd plugin |
| **Logstash** | https://grafana.com/docs/loki/latest/send-data/logstash/ | Logstash output plugin |
| **Lambda Promtail** | https://grafana.com/docs/loki/latest/send-data/lambda-promtail/ | AWS Lambda log collection |

---

### 5. Query (LogQL)

| Section | Link | Description |
|---------|------|-------------|
| **Query Best Practices** | https://grafana.com/docs/loki/latest/query/bp-query/ | Efficient querying techniques |
| **LogQL Simulator** | https://grafana.com/docs/loki/latest/query/analyzer/ | Interactive LogQL query analyzer |
| **Log Queries** | https://grafana.com/docs/loki/latest/query/log_queries/ | Log query syntax (filter, parser, label filter) |
| **Metric Queries** | https://grafana.com/docs/loki/latest/query/metric_queries/ | Convert logs to metrics with LogQL |
| **Template Functions** | https://grafana.com/docs/loki/latest/query/template_functions/ | Template functions for formatting |
| **LogCLI** | https://grafana.com/docs/loki/latest/query/logcli/ | Command-line interface for Loki |
| **Query Examples** | https://grafana.com/docs/loki/latest/query/query_examples/ | Common LogQL query patterns |
| **Query Acceleration** | https://grafana.com/docs/loki/latest/query/query_acceleration/ | Accelerator for cached queries |
| **Query Reference** | https://grafana.com/docs/loki/latest/query/query_reference/ | Complete LogQL language reference |
| **Troubleshoot Queries** | https://grafana.com/docs/loki/latest/query/troubleshoot-query/ | Debug query performance issues |

---

### 6. Visualize

| Section | Link | Description |
|---------|------|-------------|
| **Grafana Visualization** | https://grafana.com/docs/loki/latest/visualize/grafana/ | Using Loki data source in Grafana |

---

### 7. Alert

| Section | Link | Description |
|---------|------|-------------|
| **Alerting** | https://grafana.com/docs/loki/latest/alert/ | Alerting rules and Ruler configuration |

---

### 8. Operations (Manage)

| Section | Link | Description |
|---------|------|-------------|
| **Loki Canary** | https://grafana.com/docs/loki/latest/operations/loki-canary/ | Canary for monitoring Loki health |
| **Blocking Queries** | https://grafana.com/docs/loki/latest/operations/blocking-queries/ | Prevent unwanted expensive queries |
| **Caching** | https://grafana.com/docs/loki/latest/operations/caching/ | Caching strategies |
| **Rate Limits** | https://grafana.com/docs/loki/latest/operations/request-validation-rate-limits/ | Ingestion and query rate limiting |
| **Query Fairness** | https://grafana.com/docs/loki/latest/operations/query-fairness/ | Fair query scheduling across tenants |
| **Shuffle Sharding** | https://grafana.com/docs/loki/latest/operations/shuffle-sharding/ | Reducing blast radius with shuffle sharding |
| **Monitor Loki** | https://grafana.com/docs/loki/latest/operations/meta-monitoring/ | Monitoring Loki itself |
| **Authentication** | https://grafana.com/docs/loki/latest/operations/authentication/ | Authentication and authorization |
| **Bloom Filters** | https://grafana.com/docs/loki/latest/operations/bloom-filters/ | Bloom filters for index acceleration |
| **Stream Sharding** | https://grafana.com/docs/loki/latest/operations/automatic-stream-sharding/ | Automatic stream sharding |
| **Scalability** | https://grafana.com/docs/loki/latest/operations/scalability/ | Scaling Loki clusters |
| **Recording Rules** | https://grafana.com/docs/loki/latest/operations/recording-rules/ | Pre-compute frequent queries |
| **Storage - TSDB** | https://grafana.com/docs/loki/latest/operations/storage/tsdb/ | TSDB storage engine |
| **Storage - BoltDB** | https://grafana.com/docs/loki/latest/operations/storage/boltdb-shipper/ | BoltDB shipper (legacy) |
| **Log Retention** | https://grafana.com/docs/loki/latest/operations/storage/retention/ | Configure log retention policies |
| **Multi-Tenancy** | https://grafana.com/docs/loki/latest/operations/multi-tenancy/ | Multi-tenant architecture |
| **Autoscaling Queriers** | https://grafana.com/docs/loki/latest/operations/autoscaling_queriers/ | Autoscaling query components |
| **Overrides Exporter** | https://grafana.com/docs/loki/latest/operations/overrides-exporter/ | Per-tenant configuration export |
| **Zone Aware Ingesters** | https://grafana.com/docs/loki/latest/operations/zone-ingesters/ | Zone-aware ingester placement |

---

### 9. Reference

| Section | Link | Description |
|---------|------|-------------|
| **Configuration Reference** | https://grafana.com/docs/loki/latest/reference/loki-config-ref/ | Complete Loki configuration options |
| **HTTP API** | https://grafana.com/docs/loki/latest/reference/loki-http-api/ | Loki REST API endpoints |

---

### 10. Community

| Section | Link | Description |
|---------|------|-------------|
| **Contact** | https://grafana.com/docs/loki/latest/community/getting-in-touch/ | Community forums and Slack |
| **Contributing** | https://grafana.com/docs/loki/latest/community/contributing/ | Contribution guidelines |
| **Governance** | https://grafana.com/docs/loki/latest/community/governance/ | Project governance |
| **LIDs** | https://grafana.com/docs/loki/latest/community/lids/ | Loki Improvement Documents |
| **Design Documents** | https://grafana.com/docs/loki/latest/community/design-documents/ | Historical design docs |

---

## Quick Reference

### LogQL Query Examples

```logql
# Log queries
{job="varlogs",level="error"} |= "timeout"
{job="varlogs"} | json | line_format "{{.level}}: {{.msg}}"

# Metric queries
count_over_time({job="varlogs",level="error"}[5m])
rate({job="varlogs"}[1m])

# Filter operators
|= "search term"           # contains
!= "exclude term"          # does not contain
|~ "regex.*pattern"        # regex match
!~ "regex.*pattern"        # regex not match
```

### Key Configuration

```yaml
# loki-config.yaml
server:
  http_listen_port: 3100

ingester:
  lifecycler:
    ring:
      kvstore:
        store: inmemory

schema_config:
  configs:
    - from: "2024-01-01"
      store: tsdb
      object_store: filesystem
      schema: v13

storage_config:
  filesystem:
    directory: /loki/chunks

limits_config:
  retention_period: 720h       # 30 days
  ingestion_rate_mb: 10
  max_streams_per_user: 10000
```

### Promtail Pipeline Stages

```yaml
# JSON parsing
- json:
    expressions:
      level: level
      msg: msg
      time: time

# Label extraction
- labels:
    level:
    service:

# Regex parsing
- regex:
    expression: '^(?P<level>\w+)\s+(?P<message>.*)$'

# Sensitive data masking
- replace:
    expression: '(password|token)["\s:=]+["\']?[^"\'\s,}]+'
    replace: '${1}="[REDACTED]"'
```

---

## Common Use Cases

| Use Case | Query/Config |
|----------|-------------|
| **Find errors** | `{level="error"}` |
| **Count errors over time** | `count_over_time({level="error"}[5m])` |
| **Filter by service** | `{service="my-app"}` |
| **Search logs** | `{job="varlogs"} |= "search term"` |
| **Parse JSON logs** | `{service="app"} | json` |
| **Calculate error rate** | `rate({level="error"}[5m])` |
| **Trace request ID** | `{service="app"} | json | trace_id="abc-123"` |

---

## Architecture Summary

```
┌─────────────┐
│   Clients   │ (Promtail, Fluentd, OTel, Direct)
└──────┬──────┘
       │ Push logs
       ▼
┌─────────────┐
│  Distributor│ (Load balances ingestion)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Ingester   │ (Streams, chunks, compression)
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│   Long-term Storage │ (S3, GCS, Azure, local)
└─────────────────────┘
       ▲
       │ Query
       │
┌──────┴──────┐
│   Querier   │ (Queries, range queries)
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Query Frontend  │ (Split, cache, parallelize)
└─────────────────┘
       │
       ▼
┌─────────────────┐
│   Grafana       │ (Visualization)
└─────────────────┘
```

---

## Related Skills

- `grafana`: Grafana visualization and dashboards
- `prometheus`: Metrics collection and PromQL
- `tempo`: Distributed tracing
- `mimir`: Metrics storage (like Prometheus)
- `k6`: Load testing

---

**Last Updated**: 2026-01-26
**Loki Version**: 3.6.x (latest)
