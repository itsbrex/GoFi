#!/usr/bin/env python3
"""Prepare an isolated mcp-bootstrap profile and export its real UTCP manual."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', required=True, type=Path)
    parser.add_argument('--bootstrap', default='mcp-bootstrap', help='Installed mcp-bootstrap executable')
    args = parser.parse_args()
    destination = args.destination.expanduser().resolve()
    if destination.exists():
        parser.error('destination must be a new directory; existing bootstrap state is preserved')
    executable = shutil.which(args.bootstrap)
    node = shutil.which('node')
    if not executable or not node:
        parser.error('install mcp-bootstrap and Node 22/24 first')
    root = Path(__file__).resolve().parents[1]
    destination.mkdir(parents=True, mode=0o700)
    # register --dry-run still requires a config to inspect. Give it an empty,
    # isolated one rather than pointing at the user's live code-mode config.
    config_dir = destination / 'code-mode/configs'
    config_dir.mkdir(parents=True, mode=0o700)
    (config_dir / 'live.utcp_config.json').write_text('{"manual_call_templates": []}\n')
    env = {**os.environ, 'MCP_BOOTSTRAP_STATE_DIR': str(destination / 'state'),
           'MCP_BOOTSTRAP_HOME': str(destination / 'home'), 'MCP_BOOTSTRAP_INTERACTIVE': '0',
           'CODE_MODE_DIR': str(destination / 'code-mode'), 'MCP_BOOTSTRAP_NODE': node}
    # This only writes an isolated profile. Never call install/login against live hosts.
    subprocess.run([executable, 'add', 'gofi', '--command', node, '--arg', str(root / 'runtime/native-mcp.mjs'),
                    '--auth', 'none', '--title', 'GoFi Companion'], env=env, check=True, stdout=sys.stderr)
    result = subprocess.run([executable, 'register', 'gofi', '--dry-run'], env=env, check=True, capture_output=True, text=True)
    start = result.stdout.find('{')
    manual, _ = json.JSONDecoder().raw_decode(result.stdout[start:])
    if manual.get('call_template_type') != 'mcp' or manual.get('name') != 'gofi':
        raise ValueError('Unexpected mcp-bootstrap export')
    selected_env = {key: os.environ[key] for key in ('GOFI_REPO', 'GOFI_PYTHON', 'GOFI_COMPANION_STATE_DIR') if key in os.environ}
    if selected_env:
        manual['config']['mcpServers']['gofi']['env'] = selected_env
    (destination / 'gofi.utcp.json').write_text(json.dumps({'manual_call_templates': [manual]}, indent=2) + '\n')
    print(json.dumps({'config': str(destination / 'gofi.utcp.json'), 'profile': str(destination / 'state/profiles/gofi.toml'),
                      'live_host_configs_changed': False}))


if __name__ == '__main__':
    main()
