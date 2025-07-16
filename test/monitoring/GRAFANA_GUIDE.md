# Grafana Log Viewing Guide

## Accessing Logs in Grafana

### 1. Navigate to Explore
- Go to http://localhost:3000
- Login with `admin` / `admin`
- Click the **Explore** icon (compass) in the left sidebar

### 2. Select Loki Datasource
- In the top dropdown, ensure **Loki** is selected as the datasource
- If not visible, the datasource may not be configured properly

### 3. Query Logs

#### Basic Queries:
```
# All logs from all containers
{container_name=~".+"}

# DataHaven validator logs
{container_name=~"datahaven-.*"}

# Snowbridge relayer logs
{container_name=~"snowbridge-.*"}

# Ethereum node logs
{container_name=~"el-.*|cl-.*"}

# Logs with specific level
{container_name=~".+"} |= "error"
{container_name=~".+"} |= "warn"

# JSON parsed logs (if applicable)
{container_name=~".+"} | json
```

### 4. Time Range
- Use the time picker in the top right to adjust the time range
- Start with "Last 15 minutes" to see recent logs

### 5. Troubleshooting

If you don't see logs:

1. **Check if services are generating logs:**
   ```bash
   docker logs datahaven-alice --tail=10
   ```

2. **Verify Alloy is collecting logs:**
   ```bash
   docker logs datahaven-alloy --tail=50 | grep -i "scraped"
   ```

3. **Test Loki directly:**
   ```bash
   curl -G -s "http://localhost:3100/loki/api/v1/query" \
     --data-urlencode 'query={container_name=~".+"}' | jq
   ```

4. **Check datasource configuration:**
   - Go to Configuration → Data Sources in Grafana
   - Click on Loki
   - Click "Save & Test"

### 6. Creating a Dashboard

1. After finding logs in Explore, click "Add to dashboard"
2. Create panels for different services
3. Save the dashboard for future use

### Common Issues:

- **No logs appearing**: Ensure DataHaven services are running and generating logs
- **Connection refused**: Check if Loki container is running
- **Authentication error**: Use admin/admin credentials
- **Empty query results**: Broaden your time range or simplify your query