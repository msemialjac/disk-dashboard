"""Disk Usage Dashboard — Flask micro-app for learn2improve."""

import subprocess
import json
from flask import Flask, jsonify, render_template

app = Flask(__name__)


def get_disk_usage():
    """Get filesystem data from df and lsblk."""
    result = subprocess.run(
        ['df', '-B1', '--output=source,fstype,size,used,avail,pcent,target'],
        capture_output=True, text=True
    )

    filesystems = []
    skip_fstypes = {'tmpfs', 'devtmpfs', 'efivarfs'}
    skip_mounts = {'/run', '/dev/shm', '/sys', '/proc'}
    skip_mount_prefixes = ('/tmp/.mount_',)  # AppImage FUSE mounts (handy, etc.)

    for line in result.stdout.strip().split('\n')[1:]:
        parts = line.split()
        if len(parts) < 7:
            continue

        dev = parts[0]
        fstype = parts[1]
        size_b = int(parts[2])
        used_b = int(parts[3])
        avail_b = int(parts[4])
        pct_str = parts[5].rstrip('%')
        mount = ' '.join(parts[6:])

        if fstype in skip_fstypes:
            continue
        if any(mount.startswith(s) for s in skip_mounts):
            continue
        if any(mount.startswith(p) for p in skip_mount_prefixes):
            continue

        # Generate a readable label
        label = _make_label(dev, fstype, mount)
        category = 'network' if 'fuse' in fstype else 'snap' if fstype == 'squashfs' else 'physical'

        filesystems.append({
            'dev': dev,
            'mount': mount,
            'fstype': fstype,
            'sizeB': size_b,
            'usedB': used_b,
            'availB': avail_b,
            'pct': float(pct_str) if pct_str else 0,
            'label': label,
            'category': category,
        })

    # Consolidate snap mounts into a single entry
    snaps = [f for f in filesystems if f['category'] == 'snap']
    if snaps:
        filesystems = [f for f in filesystems if f['category'] != 'snap']
        total_snap = sum(s['sizeB'] for s in snaps)
        filesystems.append({
            'dev': 'snaps',
            'mount': '/var/lib/snapd',
            'fstype': 'squashfs',
            'sizeB': total_snap,
            'usedB': total_snap,
            'availB': 0,
            'pct': 100.0,
            'label': f'Snap packages ({len(snaps)} snaps)',
            'category': 'snap',
        })

    return filesystems


def _make_label(dev, fstype, mount):
    """Generate human-readable label for a filesystem."""
    if 'nvme' in dev:
        if mount == '/':
            return 'Root (NVMe SSD)'
        if mount == '/boot':
            return 'Boot (EFI)'
        return f'NVMe ({mount})'
    if 'fuse' in fstype:
        name = fstype.split('.')[-1] if '.' in fstype else fstype
        return f'{name.title()} ({mount.split("/")[-1]})'
    if fstype == 'squashfs':
        return f'Snap ({mount.split("/")[-1]})'
    if mount == '/home':
        return 'Home (HDD)' if 'sd' in dev else f'Home ({dev})'
    if mount == '[SWAP]':
        return 'Swap (zram)' if 'zram' in dev else 'Swap'
    if 'sd' in dev:
        return f'Disk {dev.split("/")[-1]} ({mount})'
    return f'{dev} ({mount})'


@app.route('/')
def index():
    return render_template('dashboard.html')


@app.route('/api/disk')
def api_disk():
    return jsonify(get_disk_usage())


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5050, debug=False)
