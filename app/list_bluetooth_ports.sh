#!/bin/bash
# list_bluetooth_ports.sh
# This script lists Bluetooth controllers and the connected devices on each.
# Output is a JSON object where each key is a controller identifier and
# the value is an array of connected device objects.

# Start JSON object
result="{"

first_controller=1

# Get list of controllers from bluetoothctl
while IFS= read -r line; do
    # Expected format: Controller <MAC> <NAME>
    if [[ $line =~ ^Controller[[:space:]]([[:xdigit:]:]{17})[[:space:]](.+) ]]; then
        controller_mac="${BASH_REMATCH[1]}"
        controller_name="${BASH_REMATCH[2]}"
        
        # Query connected devices for the controller
        devices=$(bluetoothctl <<EOF
select $controller_mac
devices Connected
EOF
)

        # Build a JSON array for connected devices
        devices_array=()
        while IFS= read -r dev_line; do
            if [[ $dev_line =~ ^Device[[:space:]]([[:xdigit:]:]{17})[[:space:]](.+) ]]; then
                dev_mac="${BASH_REMATCH[1]}"
                dev_name="${BASH_REMATCH[2]}"
                devices_array+=("{\"mac\": \"$dev_mac\", \"name\": \"$dev_name\"}")
            fi
        done <<< "$devices"
        
        # Join the devices into a JSON array (comma-separated)
        devices_json=$(IFS=,; echo "[${devices_array[*]}]")
        
        # Append this controller and its devices to the result JSON
        if [ $first_controller -eq 1 ]; then
            first_controller=0
        else
            result+=","
        fi
        
        # Use a composite key with MAC and name for clarity
        result+="\"$controller_mac ($controller_name)\": $devices_json"
    fi
done < <(bluetoothctl list)

result+="}"
echo "$result"
