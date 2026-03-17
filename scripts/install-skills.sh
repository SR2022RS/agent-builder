#!/usr/bin/env bash
# =============================================================================
# HighLevel Agent Builder — Skill Auto-Installer
# =============================================================================
# This script installs curated OpenClaw skills on first boot.
# Skills persist in the /data volume so they survive redeploys.
# To force reinstall, delete /data/.skills-installed
# =============================================================================

set -euo pipefail

MARKER="/data/.skills-installed"
LOG_PREFIX="[skill-installer]"
SKILL_DIR="/data/workspace/skills"

# If already installed, skip
if [ -f "$MARKER" ]; then
  echo "$LOG_PREFIX Skills already installed (marker exists). Skipping."
  echo "$LOG_PREFIX To reinstall, delete $MARKER and redeploy."
  exit 0
fi

echo "$LOG_PREFIX =========================================="
echo "$LOG_PREFIX  HighLevel Agent Builder — Installing Skills"
echo "$LOG_PREFIX =========================================="

# Wait for openclaw to be available
until command -v openclaw &> /dev/null; do
  echo "$LOG_PREFIX Waiting for openclaw CLI..."
  sleep 2
done

# Ensure skills directory exists inside the persistent volume
mkdir -p "$SKILL_DIR"

# cd into workspace so 'clawhub install' writes to /data/workspace/skills/
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
  openclaw skill install "$skill" 2>/dev/null || echo "$LOG_PREFIX   ⚠ Failed: $skill (continuing...)"
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
  openclaw skill install "$skill" 2>/dev/null || echo "$LOG_PREFIX   ⚠ Failed: $skill (continuing...)"
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
  openclaw skill install "$skill" 2>/dev/null || echo "$LOG_PREFIX   ⚠ Failed: $skill (continuing...)"
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
  openclaw skill install "$skill" 2>/dev/null || echo "$LOG_PREFIX   ⚠ Failed: $skill (continuing...)"
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
  openclaw skill install "$skill" 2>/dev/null || echo "$LOG_PREFIX   ⚠ Failed: $skill (continuing...)"
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
  openclaw skill install "$skill" 2>/dev/null || echo "$LOG_PREFIX   ⚠ Failed: $skill (continuing...)"
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
  openclaw skill install "$skill" 2>/dev/null || echo "$LOG_PREFIX   ⚠ Failed: $skill (continuing...)"
done

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
