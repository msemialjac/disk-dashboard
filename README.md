# Disk Usage Dashboard

A real-time disk usage dashboard built with Flask and vanilla JavaScript. Monitors all mounted filesystems on a Linux host with live-updating bar charts, SVG donut visualizations, and a copyable AI-prompt summary.

![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue)
![Flask 3.0+](https://img.shields.io/badge/flask-3.0%2B-green)

## Features

- **Bar & donut views** — toggle between horizontal usage bars and an SVG donut chart with three modes (capacity, detail, used)
- **Live refresh** — auto-polls `/api/disk` at configurable intervals (10s–5min or manual)
- **Smart filtering** — filter by physical disks, network/FUSE mounts, or snap packages; sort by usage %, size, or name
- **Threshold warnings** — configurable warning threshold (50–90%) with visual indicators on bars
- **Filesystem detail panel** — click any filesystem to see device, mount point, fstype, and precise usage
- **Prompt output** — generates a copyable plain-text disk report for pasting into AI assistants
- **Snap consolidation** — groups all squashfs snap mounts into a single summary entry
- **Noise filtering** — hides tmpfs, devtmpfs, efivarfs, AppImage FUSE mounts, and system pseudo-filesystems
- **Tokyo Night theme** — dark UI with responsive layout (mobile-friendly at 768px breakpoint)

## Quick Start

```bash
# Clone and enter the project
git clone <repo-url> && cd disk-dashboard

# Create a virtual environment and install dependencies
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run the dashboard
python app.py
```

Open **http://127.0.0.1:5050** in your browser.

## Project Structure

```
disk-dashboard/
├── app.py               # Flask app — /api/disk endpoint + df parsing
├── requirements.txt     # flask>=3.0
├── templates/
│   └── dashboard.html   # Single-page HTML shell
└── static/
    ├── dashboard.js     # Vanilla JS — fetch, render, SVG donut, controls
    └── style.css        # Tokyo Night dark theme, responsive grid
```

## API

### `GET /api/disk`

Returns a JSON array of filesystem objects:

```json
[
  {
    "dev": "/dev/nvme0n1p2",
    "mount": "/",
    "fstype": "ext4",
    "sizeB": 234685313024,
    "usedB": 89012543488,
    "availB": 133671567360,
    "pct": 37.9,
    "label": "Root (NVMe SSD)",
    "category": "physical"
  }
]
```

| Field      | Description                                      |
|------------|--------------------------------------------------|
| `dev`      | Block device path                                |
| `mount`    | Mount point                                      |
| `fstype`   | Filesystem type (ext4, btrfs, fuse.rclone, etc.) |
| `sizeB`    | Total size in bytes                               |
| `usedB`    | Used space in bytes                               |
| `availB`   | Available space in bytes                          |
| `pct`      | Usage percentage                                  |
| `label`    | Human-readable label (auto-generated)             |
| `category` | `physical`, `network`, or `snap`                  |

## Requirements

- **Python 3.10+** with Flask 3.0+
- **Linux** — relies on `df -B1` for filesystem data
- A modern browser (ES5+; no build step needed)

## License

MIT
