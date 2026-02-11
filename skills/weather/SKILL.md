---
name: weather
description: Get current weather and forecasts (no API key required).
homepage: https://open-meteo.com/en/docs
metadata: {"crocbot":{"emoji":"🌤️","requires":{"bins":["curl"]}}}
---

# Weather

Two free services, no API keys needed. Open-Meteo is primary; wttr.in is fallback.

## Open-Meteo (primary)

Free, no API key, returns JSON.

### Step 1 — Geocode the city

```bash
curl -s "https://geocoding-api.open-meteo.com/v1/search?name=London&count=1"
```

Response gives `results[0].latitude` and `results[0].longitude`.

### Step 2 — Current weather

```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=51.5074&longitude=-0.1278&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&temperature_unit=celsius&wind_speed_unit=kmh"
```

Parse `current` object for temperature, humidity, feels-like, wind, and weather code.

### Step 3 — Multi-day forecast (optional)

Append daily fields and forecast horizon:

```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=51.5074&longitude=-0.1278&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=3&temperature_unit=celsius&wind_speed_unit=kmh"
```

`daily` arrays are indexed by `daily.time[]`.

### WMO weather codes

| Code | Condition |
|------|-----------|
| 0 | Clear sky |
| 1, 2, 3 | Mainly clear, Partly cloudy, Overcast |
| 45, 48 | Fog, Depositing rime fog |
| 51, 53, 55 | Drizzle: light, moderate, dense |
| 56, 58 | Freezing drizzle: light, dense |
| 61, 63, 65 | Rain: slight, moderate, heavy |
| 66, 67 | Freezing rain: light, heavy |
| 71, 73, 75 | Snowfall: slight, moderate, heavy |
| 77 | Snow grains |
| 80, 81, 82 | Rain showers: slight, moderate, violent |
| 85, 86 | Snow showers: slight, heavy |
| 95 | Thunderstorm |
| 96, 99 | Thunderstorm with hail: slight, heavy |

### Unit options

- `temperature_unit`: `celsius` (default) or `fahrenheit`
- `wind_speed_unit`: `kmh` (default), `mph`, `ms`, `kn`

## wttr.in (fallback)

Use only if Open-Meteo is unreachable.

Quick one-liner:
```bash
curl -s "wttr.in/London?format=3"
# Output: London: ⛅️ +8°C
```

Compact format:
```bash
curl -s "wttr.in/London?format=%l:+%c+%t+%h+%w"
# Output: London: ⛅️ +8°C 71% ↙5km/h
```

Full forecast:
```bash
curl -s "wttr.in/London?T"
```

Format codes: `%c` condition · `%t` temp · `%h` humidity · `%w` wind · `%l` location · `%m` moon

Tips:
- URL-encode spaces: `wttr.in/New+York`
- Airport codes: `wttr.in/JFK`
- Units: `?m` (metric) `?u` (USCS)
- Today only: `?1` · Current only: `?0`
- PNG: `curl -s "wttr.in/Berlin.png" -o /tmp/weather.png`
