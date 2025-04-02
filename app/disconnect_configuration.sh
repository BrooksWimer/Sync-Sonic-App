#!/bin/bash
set -e

###########################################################################
# Logging helper (send logs to stderr so they don't mix with stdout)
###########################################################################
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

###########################################################################
# Validate arguments and parse JSON input
###########################################################################
if [ "$#" -ne 4 ]; then
    log "Usage: $0 <configID> <configName> <speakersJson> <settingsJson>"
    exit 1
fi

CONFIG_ID="$1"
CONFIG_NAME="$2"
SPEAKERS_JSON="$3"
SETTINGS_JSON="$4"

log "Starting disconnect process for configuration '$CONFIG_NAME' (ID: $CONFIG_ID)..."

###########################################################################
# Parse speakers from JSON input
###########################################################################
log "Parsing speakers from JSON input..."
declare -A speakers
while IFS=, read -r mac name; do
    speakers["$mac"]="$name"
    log "Found speaker: $name ($mac)"
done < <(echo "$SPEAKERS_JSON" | jq -r 'to_entries[] | "\(.key),\(.value)"')

if [ ${#speakers[@]} -eq 0 ]; then
    log "No speakers found in JSON input."
    exit 1
fi
log "Total speakers to process: ${#speakers[@]}"

###########################################################################
# Discover available Bluetooth controllers
###########################################################################
log "Discovering available Bluetooth controllers..."
controllers=()
while IFS= read -r line; do
    if [[ $line =~ Controller[[:space:]]+([[:xdigit:]:]{17}) ]]; then
        controllers+=("${BASH_REMATCH[1]}")
        log "Found controller: ${BASH_REMATCH[1]}"
    fi
done < <(bluetoothctl list)

if [ ${#controllers[@]} -eq 0 ]; then
    log "No Bluetooth controllers found."
    exit 1
fi
log "Total controllers found: ${#controllers[@]}"

###########################################################################
# Disconnect speakers from controllers
###########################################################################
log "Starting speaker disconnection process..."
for ctrl in "${controllers[@]}"; do
    log "Processing controller: $ctrl"
    
    # Select the controller and get connected devices
    log "Getting connected devices for controller $ctrl..."
    CONNECTED_OUTPUT=$(bluetoothctl <<EOF
select $ctrl
devices Connected
EOF
)
    
    # Process each connected device
    while IFS= read -r line; do
        if [[ $line =~ ^Device[[:space:]]([[:xdigit:]:]{17})[[:space:]](.+) ]]; then
            dev_mac="${BASH_REMATCH[1]}"
            dev_name="${BASH_REMATCH[2]}"
            
            if [ -n "${speakers[$dev_mac]}" ]; then
                log "Found target speaker: $dev_name ($dev_mac) on controller $ctrl"
                log "Attempting to disconnect..."
                
                # Attempt disconnection
                DISCONNECT_OUTPUT=$(bluetoothctl <<EOF
select $ctrl
disconnect $dev_mac
EOF
)
                log "Disconnect command output: $DISCONNECT_OUTPUT"
                
                # Verify disconnection
                sleep 2
                VERIFY_OUTPUT=$(bluetoothctl <<EOF
select $ctrl
devices Connected
EOF
)
                if ! echo "$VERIFY_OUTPUT" | grep -q "$dev_mac"; then
                    log "Successfully disconnected $dev_name ($dev_mac) from controller $ctrl"
                else
                    log "Warning: $dev_name ($dev_mac) may still be connected to controller $ctrl"
                fi
            else
                log "Skipping non-target device: $dev_name ($dev_mac)"
            fi
        fi
    done <<< "$CONNECTED_OUTPUT"
done

###########################################################################
# Clean up PulseAudio modules
###########################################################################
log "Starting PulseAudio cleanup process..."

# Unload loopback modules for each speaker sink
log "Processing speaker sink loopbacks..."
for mac in "${!speakers[@]}"; do
    sink_name="bluez_sink.${mac//:/_}.a2dp_sink"
    log "Checking loopbacks for sink: $sink_name"
    
    module_ids=$(pactl list short modules | grep module-loopback | grep "$sink_name" | awk '{print $1}')
    if [ -n "$module_ids" ]; then
        log "Found loopback modules for $sink_name: $module_ids"
        for id in $module_ids; do
            log "Unloading loopback module $id for $sink_name..."
            if pactl unload-module "$id"; then
                log "Successfully unloaded module $id"
            else
                log "Failed to unload module $id"
            fi
        done
    else
        log "No loopback modules found for $sink_name"
    fi
done

# Unload virtual sink modules
log "Processing virtual sink modules..."
virtual_sinks=$(pactl list short modules | grep module-null-sink | awk '{print $1}')
if [ -n "$virtual_sinks" ]; then
    log "Found virtual sink modules: $virtual_sinks"
    for mod in $virtual_sinks; do
        log "Unloading virtual sink module $mod..."
        if pactl unload-module "$mod"; then
            log "Successfully unloaded virtual sink module $mod"
        else
            log "Failed to unload virtual sink module $mod"
        fi
    done
else
    log "No virtual sink modules found"
fi

###########################################################################
# Final status
###########################################################################
log "Disconnect process complete for configuration '$CONFIG_NAME' (ID: $CONFIG_ID)"
log "Processed ${#speakers[@]} speakers across ${#controllers[@]} controllers" 