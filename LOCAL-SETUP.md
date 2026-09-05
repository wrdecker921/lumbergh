# Laptop Lumbergh setup — run from source with local tweaks + autostart

Written 2026-09-05 on the desktop. This supersedes the old
`selection-copy-feature.md` workflow (patch-onto-PyPI-version). Hand this doc
to Claude Code on the laptop (LAPTOP-5IEUOK7B).

## What changed

Upstream Lumbergh moved v0.18.5 → v0.22.0 (~212 commits) and independently
built most of our personal terminal feature: drag-select with output freeze,
copy-on-release with "Copied" toast, http-fallback clipboard, and Ctrl+V
browser-native paste (now a Settings → General toggle, `ctrlVPastes`, default
on; Ctrl+Alt+V sends a literal ^V). So the desktop's `my-local-changes` branch
was rebuilt on top of origin/main with only the two changes upstream still
lacks:

1. `ec0be7c` feat(terminal): reflow copied paragraphs, Ctrl-release copies raw
2. `8888a64` fix(terminal): clear selection after copy (stale-selection
   clipboard clobber — bug still exists upstream)

The old v0.18.5-based branch is preserved on the desktop as
`backup/my-local-changes-v0.18.5`.

## Step 1 — get the code

Preferred: clone the fork (branch `my-local-changes` on
`wrdecker921/lumbergh`) once it exists:

```bash
cd ~/projects
git clone https://github.com/wrdecker921/lumbergh
cd lumbergh
git checkout my-local-changes
```

If the fork/branch isn't up yet, fall back to upstream + patch
(`selection-copy.patch` in this folder, regenerated 2026-09-05, verified to
apply cleanly on origin/main @ v0.22.0):

```bash
cd ~/projects
git clone https://github.com/voglster/lumbergh
cd lumbergh
git checkout -b my-local-changes origin/main
git apply ~/.config/lumbergh/shared/selection-copy.patch
git add -A && git commit -m "local terminal tweaks (reflow + clearSelection)"
```

## Step 2 — build and verify by hand

```bash
cd ~/projects/lumbergh/frontend && npm install && npm run build
cd ../backend && uv sync && uv run lumbergh
```

`uv run lumbergh` MUST be run from `backend/` — anywhere else uv silently
falls through to the globally installed pylumbergh tool (old bundled
frontend). Once this works, optionally remove the global tool so it can never
shadow again: `uv tool uninstall pylumbergh`.

Verify the served bundle matches the build:

```bash
curl -s http://localhost:8420/ | grep -o 'index-[^"]*\.js'
grep -o 'index-[^"]*\.js' ~/projects/lumbergh/frontend/dist/index.html
```

Then in the browser: DevTools → right-click reload button → "Empty cache and
hard reload" (the PWA service worker clings to old bundles; do this per origin
— localhost AND the tailscale https origin).

## Step 3 — autostart on boot

`autostart-local-checkout.sh` (this folder) is the desktop's working script.
Install it:

```bash
cp ~/.config/lumbergh/shared/autostart-local-checkout.sh ~/.config/lumbergh/autostart.sh
chmod +x ~/.config/lumbergh/autostart.sh
# edit CHECKOUT if the laptop's repo path differs from ~/projects/lumbergh
```

It no-ops if :8420 is already up, else cd's into the checkout's backend/ and
`exec`s `uv run --no-sync lumbergh` (--no-sync so boot never needs network;
the venv must already exist from step 2's `uv sync`).

Wire it into Windows Task Scheduler WITHOUT a popping console window, using
the wscript trick (same fix as the desktop's Home Services task):

1. Create `C:\Users\<you>\lumbergh-autostart.vbs` containing (adjust distro
   name — check `wsl -l` on the laptop; desktop uses Ubuntu-Isolated, laptop
   may just be Ubuntu):

   ```vbs
   CreateObject("WScript.Shell").Run "wsl.exe -d Ubuntu -- bash -lc /home/wrdecker921/.config/lumbergh/autostart.sh", 0, False
   ```

2. Task Scheduler → Create Task:
   - Trigger: At log on (of your user)
   - Action: Program `wscript.exe`, Arguments `"C:\Users\<you>\lumbergh-autostart.vbs"`
   - "Run only when user is logged on" (NOT "whether logged on or not" — WSL
     interop breaks in session 0)
   - Optionally repeat every 5 minutes so it self-heals (the script no-ops
     when the server is already up)

3. Also re-arm phone access after boot. Tailscale serve config normally
   persists across reboots, but verify with
   `tailscale.exe serve status` (from PowerShell or WSL interop); if empty:
   `tailscale.exe serve --bg --https=8444 http://localhost:8420`.
   Phone URL: https://billy-work-laptop.tailf7ffa0.ts.net:8444

## Known laptop trap

If after a reboot WSL has no network (claude CLI ConnectionRefused, Lumbergh
page "loads" from PWA cache but reloads produce zero server log lines, and
`wslinfo --networking-mode` says "none"): that's the recurring mirrored
networking failure (0x8007054f). Fix from admin PowerShell:
`wsl --shutdown; Restart-Service hns -Force; wsl`

## Staying updated (both machines)

```bash
git fetch origin            # upstream voglster/lumbergh
git rebase origin/main      # replay the two local commits
cd frontend && npm install && npm run build && cd ../backend && uv sync
# restart the server, then Empty-cache-and-hard-reload the browser
```

If the fork exists, push the rebased branch (`git push -f fork
my-local-changes`) on whichever machine rebased first and `git pull` on the
other (`git reset --hard fork/my-local-changes` after fetching, since rebases
rewrite the branch).
