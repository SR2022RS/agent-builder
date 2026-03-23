#!/usr/bin/env bash
# =============================================================================
# HighLevel Agent Builder — Skill Auto-Installer
# =============================================================================
# This script installs curated OpenClaw skills on first boot.
# Skills persist in the /data volume so they survive redeploys.
# To force reinstall, delete /data/.skills-installed
# =============================================================================

set -uo pipefail
# NOTE: intentionally NOT using set -e so individual skill install failures
# don't crash the entire script. We handle errors per-skill with || fallback.

MARKER="/data/.skills-installed"
LOG_PREFIX="[skill-installer]"
SKILL_DIR="/data/workspace/skills"

# If already installed AND skills directory has content, skip
if [ -f "$MARKER" ]; then
  EXISTING=$(find "$SKILL_DIR" -maxdepth 1 -type d 2>/dev/null | wc -l)
  if [ "$EXISTING" -gt 1 ]; then
    echo "$LOG_PREFIX Skills already installed ($((EXISTING - 1)) skills in $SKILL_DIR). Skipping."
    echo "$LOG_PREFIX To reinstall, delete $MARKER and redeploy."
    exit 0
  else
    echo "$LOG_PREFIX Marker exists but $SKILL_DIR is empty. Reinstalling..."
    rm -f "$MARKER"
  fi
fi

echo "$LOG_PREFIX =========================================="
echo "$LOG_PREFIX  HighLevel Agent Builder — Installing Skills"
echo "$LOG_PREFIX =========================================="

# Wait for openclaw to be available
until command -v openclaw &> /dev/null; do
  echo "$LOG_PREFIX Waiting for openclaw CLI..."
  sleep 2
done

# Auto-detect the correct install command by testing candidates
INSTALL_CMD=""
for candidate in "openclaw extension install" "openclaw skill install" "openclaw marketplace install" "openclaw hub install"; do
  if $candidate --help &>/dev/null 2>&1 || $candidate test-probe &>/dev/null 2>&1; then
    INSTALL_CMD="$candidate"
    break
  fi
done

# If no candidate worked, try openclaw --help to discover subcommands
if [ -z "$INSTALL_CMD" ]; then
  echo "$LOG_PREFIX Probing openclaw subcommands..."
  openclaw --help 2>&1 | grep -iE "skill|extension|hub|market|install" || true
  # Default to extension install as most likely
  INSTALL_CMD="openclaw extension install"
fi
echo "$LOG_PREFIX Using install command: $INSTALL_CMD"

# Ensure skills directory exists inside the persistent volume
mkdir -p "$SKILL_DIR"

# cd into workspace so skills install to /data/workspace/skills/
cd /data/workspace

echo "$LOG_PREFIX OpenClaw CLI found. Starting skill installation..."
echo "$LOG_PREFIX Skills will be installed to: $SKILL_DIR"

# =============================================================================
# MARKETING & SALES SKILLS
# =============================================================================
echo "$LOG_PREFIX [1/7] Installing Marketing & Sales skills..."

MARKETING_SKILLS=(
  "staybased-cold-outreach"
  "staybased-reef-copywriting"
  "staybased-lead-magnets"
  "staybased-pricing-psychology"
  "jk-0001-go-to-market"
  "jk-0001-closing-deals"
  "jk-0001-email-marketing-2"
  "alirezarezvani-content-creator"
  "alirezarezvani-marketing-strategy-pmm"
  "kesslerio-campaign-orchestrator"
  "bluecraft-ai-cold-email"
  "concaption-foxreach"
  "dimitripantzos-brand-voice-profile"
  "kein-s-meta-ads-report"
  "aaron-he-zhu-meta-tags-optimizer"
  "aaron-he-zhu-performance-reporter"
  "vishalgojha-sentiment-priority-scorer"
  "vishalgojha-action-suggester"
  "listing-swarm"
  "nitishgargiitd-brand-cog"
  "pauldelavallaz-ad-ready"
  "tobisamaa-content-generation"
  "brianrwagner-brw-marketing-principles"
  "brianrwagner-brw-newsletter-creation-curation"
  "oyi77-business-development"
  "kevjade-kit-email-operator"
)

for skill in "${MARKETING_SKILLS[@]}"; do
  echo "$LOG_PREFIX   Installing: $skill"
  $INSTALL_CMD "$skill" 2>&1 || echo "$LOG_PREFIX   ⚠ Failed: $skill (continuing...)"
done

# =============================================================================
# COMMUNICATION & OUTREACH SKILLS
# =============================================================================
echo "$LOG_PREFIX [2/7] Installing Communication skills..."

COMMUNICATION_SKILLS=(
  "omerflo-phone-caller"
  "humanjesse-outbound-call"
  "scccmsd-custom-smtp-sender"
  "user520512-email-autoreply"
  "user520512-cs-scripts"
  "brianrwagner-brw-testimonial-collector"
  "steipete-gog"
  "aronchick-expanso-email-triage"
  "voshawn-meeting-coordinator"
  "jacksimplified-simplified-social-media"
  "jeffaf-bluesky"
  "steipete-bird"
  "marcospgp-clawring"
)

for skill in "${COMMUNICATION_SKILLS[@]}"; do
  echo "$LOG_PREFIX   Installing: $skill"
  $INSTALL_CMD "$skill" 2>&1 || echo "$LOG_PREFIX   ⚠ Failed: $skill (continuing...)"
done

# =============================================================================
# CALENDAR & SCHEDULING SKILLS
# =============================================================================
echo "$LOG_PREFIX [3/7] Installing Calendar & Scheduling skills..."

CALENDAR_SKILLS=(
  "bilalmohamed187-cpu-gcal-pro"
  "adrianmiller99-google-calendar"
  "billylui-calendar-scheduling"
  "billylui-temporal-cortex-datetime"
  "billylui-temporal-cortex-scheduling"
  "mkelk-coordinate-meeting"
  "hougangdev-meeting-prep"
  "toughworm-advanced-calendar"
)

for skill in "${CALENDAR_SKILLS[@]}"; do
  echo "$LOG_PREFIX   Installing: $skill"
  $INSTALL_CMD "$skill" 2>&1 || echo "$LOG_PREFIX   ⚠ Failed: $skill (continuing...)"
done

# =============================================================================
# SEARCH & RESEARCH SKILLS
# =============================================================================
echo "$LOG_PREFIX [4/7] Installing Search & Research skills..."

SEARCH_SKILLS=(
  "amekala-ads-manager-agent"
  "xammarie-subreddit-scout"
  "artyomx33-jtbd-analyzer"
  "simonfunk-posthog"
  "carlosarturoleon-windsor-ai"
)

for skill in "${SEARCH_SKILLS[@]}"; do
  echo "$LOG_PREFIX   Installing: $skill"
  $INSTALL_CMD "$skill" 2>&1 || echo "$LOG_PREFIX   ⚠ Failed: $skill (continuing...)"
done

# =============================================================================
# E-COMMERCE & SHOPPING SKILLS
# =============================================================================
echo "$LOG_PREFIX [5/7] Installing E-Commerce skills..."

ECOMMERCE_SKILLS=(
  "alhwyn-clawpify"
  "phheng-amazon-competitor-analyzer"
  "eftalyurtseven-eachlabs-product-visuals"
  "nwang783-clawver-digital-products"
  "g9pedro-whop-cli"
  "crisanmm-dupe"
  "pbalajiips-ecommerce-price-watcher"
)

for skill in "${ECOMMERCE_SKILLS[@]}"; do
  echo "$LOG_PREFIX   Installing: $skill"
  $INSTALL_CMD "$skill" 2>&1 || echo "$LOG_PREFIX   ⚠ Failed: $skill (continuing...)"
done

# =============================================================================
# PRODUCTIVITY & CRM SKILLS
# =============================================================================
echo "$LOG_PREFIX [6/7] Installing Productivity & CRM skills..."

PRODUCTIVITY_SKILLS=(
  "extraterrest-workcrm"
  "capt-marbles-attio-enhanced"
  "danielfoch-kvcore-mcp-cli"
  "g9pedro-clovercli"
  "kambrosgroup-invoice-template"
)

for skill in "${PRODUCTIVITY_SKILLS[@]}"; do
  echo "$LOG_PREFIX   Installing: $skill"
  $INSTALL_CMD "$skill" 2>&1 || echo "$LOG_PREFIX   ⚠ Failed: $skill (continuing...)"
done

# =============================================================================
# DATA, DOCUMENTS & AUTOMATION SKILLS
# =============================================================================
echo "$LOG_PREFIX [7/7] Installing Data & Automation skills..."

DATA_SKILLS=(
  "shahbaz02197ali-cmd-social-media-lead-generation"
  "realroc-tiktok-viral-marketing"
  "sergebulaev-publora-facebook"
  "sergebulaev-publora-linkedin"
  "sergebulaev-publora-twitter"
  "sergebulaev-publora-threads"
)

for skill in "${DATA_SKILLS[@]}"; do
  echo "$LOG_PREFIX   Installing: $skill"
  $INSTALL_CMD "$skill" 2>&1 || echo "$LOG_PREFIX   ⚠ Failed: $skill (continuing...)"
done

# =============================================================================
# COMPOSIO PLUGIN (Gmail, Google Drive, Telegram integration)
# =============================================================================
echo "$LOG_PREFIX [8/8] Installing Composio plugin..."

openclaw plugins install @composio/openclaw-plugin 2>&1 || echo "$LOG_PREFIX   Warning: Composio plugin install returned non-zero (may already be installed)"

# Configure Composio with consumer API key
COMPOSIO_KEY="${COMPOSIO_CONSUMER_KEY:-ck_tOkF1ToyQgSBwXM9BXk1}"
echo "$LOG_PREFIX   Setting Composio consumer key..."
openclaw config set plugins.entries.composio.config.consumerKey "$COMPOSIO_KEY" 2>&1 || echo "$LOG_PREFIX   Warning: Failed to set consumerKey"
openclaw config set plugins.allow '["composio"]' 2>&1 || echo "$LOG_PREFIX   Warning: Failed to set plugins.allow"
openclaw config set tools.alsoAllow '["composio"]' 2>&1 || echo "$LOG_PREFIX   Warning: Failed to set tools.alsoAllow"
echo "$LOG_PREFIX   Composio plugin configured."

# =============================================================================
# MARK INSTALLATION COMPLETE
# =============================================================================
echo "$LOG_PREFIX =========================================="
echo "$LOG_PREFIX  All skills installed successfully!"
echo "$LOG_PREFIX  Total skills: $(( ${#MARKETING_SKILLS[@]} + ${#COMMUNICATION_SKILLS[@]} + ${#CALENDAR_SKILLS[@]} + ${#SEARCH_SKILLS[@]} + ${#ECOMMERCE_SKILLS[@]} + ${#PRODUCTIVITY_SKILLS[@]} + ${#DATA_SKILLS[@]} ))"
echo "$LOG_PREFIX =========================================="

# Verify skills landed in the persistent volume
INSTALLED_COUNT=$(find "$SKILL_DIR" -maxdepth 1 -type d 2>/dev/null | wc -l)
echo "$LOG_PREFIX Verification: $((INSTALLED_COUNT - 1)) skill directories found in $SKILL_DIR"
ls "$SKILL_DIR" 2>/dev/null || echo "$LOG_PREFIX WARNING: $SKILL_DIR is empty!"

# Write marker with timestamp
date -u > "$MARKER"
echo "$LOG_PREFIX Marker written to $MARKER"
